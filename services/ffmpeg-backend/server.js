import express from "express";
import ffmpeg from "fluent-ffmpeg";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json({ limit: "10mb" }));

const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || process.env.RENDER_SERVICE_NAME || process.env.NODE_ENV || "local";
const sentryRelease = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "dev";

function parseSentryDsn(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) return null;
    return {
      protocol: url.protocol.replace(":", ""),
      host: url.host,
      projectId,
      publicKey: url.username,
    };
  } catch (error) {
    console.warn("[Sentry] Invalid DSN", error);
    return null;
  }
}

const sentryConfig = parseSentryDsn(process.env.SENTRY_DSN);

if (!sentryConfig) {
  console.info("[Sentry] disabled for ffmpeg backend (missing DSN)");
} else {
  console.info(
    JSON.stringify({
      event: "ffmpeg.sentry.enabled",
      environment: sentryEnvironment,
      release: sentryRelease,
    }),
  );
}

function buildSentryAuthHeader(config) {
  return [
    "Sentry sentry_version=7",
    "sentry_client=alfie-ffmpeg/1.0",
    `sentry_key=${config.publicKey}`,
    `sentry_timestamp=${Math.floor(Date.now() / 1000)}`,
  ].join(", ");
}

async function sendToSentry(error, context = {}) {
  if (!sentryConfig) return;

  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  const stack = err.stack
    ? err.stack
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((line) => ({ filename: line, function: "?", lineno: 0, colno: 0 }))
    : undefined;

  try {
    const response = await fetch(`${sentryConfig.protocol}://${sentryConfig.host}/api/${sentryConfig.projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": buildSentryAuthHeader(sentryConfig),
      },
      body: JSON.stringify({
        event_id: randomUUID(),
        timestamp: new Date().toISOString(),
        platform: "node",
        release: sentryRelease,
        environment: sentryEnvironment,
        exception: {
          values: [
            {
              type: err.name || "Error",
              value: err.message || String(err),
              stacktrace: stack ? { frames: stack } : undefined,
            },
          ],
        },
        tags: {
          service: "ffmpeg-backend",
          job_id: context.jobId || "unknown",
        },
        extra: context,
      }),
    });

    if (!response.ok) {
      console.warn("[Sentry] Failed to report error", await response.text());
    }
  } catch (transportError) {
    console.warn("[Sentry] Transport failed", transportError);
  }
}

const metricEvents = [];

function recordMetric(status) {
  metricEvents.push({ status, ts: Date.now() });
}

const metricsTimer = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  const recent = metricEvents.filter((m) => m.ts >= cutoff);
  const metrics = {
    queued: 0,
    processing: 0,
    done: 0,
    error: 0,
  };

  for (const event of recent) {
    if (Object.prototype.hasOwnProperty.call(metrics, event.status)) {
      metrics[event.status] += 1;
    }
  }

  if (metricEvents.length !== recent.length) {
    metricEvents.splice(0, metricEvents.length, ...recent);
  }

  console.log(
    JSON.stringify({
      event: "ffmpeg.metrics.per_minute",
      since: new Date(cutoff).toISOString(),
      metrics,
    }),
  );
}, 60_000);

if (typeof metricsTimer.unref === "function") {
  metricsTimer.unref();
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        event: "ffmpeg.request",
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });
  next();
});

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/**
 * Minimal concat from one image → looped mp4 (placeholder but functional)
 * POST /image-to-video { imageUrl, durationSec, ar } → mp4 url (stdout piping disabled on Render, just write file)
 */
app.post("/image-to-video", async (req, res) => {
  const jobId = `img2vid_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
  const startedAt = Date.now();

  const log = (status, extra = {}) => {
    const payload = {
      event: `ffmpeg.job.${status}`,
      jobId,
      durationMs: Date.now() - startedAt,
      ...extra,
    };
    const logFn = status === "error" ? console.error : console.log;
    logFn(JSON.stringify(payload));
  };

  try {
    const { imageUrl, durationSec = 10, ar = "9:16" } = req.body || {};
    if (!imageUrl) {
      log("error", { error: "imageUrl required" });
      return res.status(400).json({ error: "imageUrl required", jobId });
    }

    log("start", { imageUrl, durationSec, aspectRatio: ar });
    recordMetric("processing");

    const size = ar === "16:9" ? "1920x1080" : ar === "1:1" ? "1080x1080" : "1080x1920";
    const out = `/tmp/out_${Date.now()}.mp4`;

    await new Promise((resolve, reject) => {
      ffmpeg(imageUrl)
        .loop(durationSec)
        .videoFilter([`scale=${size}:force_original_aspect_ratio=decrease`, "format=yuv420p"])
        .fps(30)
        .outputOptions(["-movflags +faststart"])
        .output(out)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    recordMetric("done");
    // In real usage: upload `out` to S3/Cloudinary then return that URL.
    log("success", { outputFile: out });
    res.json({ ok: true, file: out, jobId });
  } catch (e) {
    recordMetric("error");
    const errorMessage = e?.message || "ffmpeg error";
    log("error", { error: errorMessage });
    void sendToSentry(e, { jobId, imageUrl: req.body?.imageUrl, durationSec: req.body?.durationSec, aspectRatio: req.body?.ar });
    res.status(500).json({ error: errorMessage, jobId });
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("[ffmpeg] Unhandled rejection", reason);
  void sendToSentry(reason || new Error("unhandledRejection"));
});

process.on("uncaughtException", (error) => {
  console.error("[ffmpeg] Uncaught exception", error);
  void sendToSentry(error);
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`[ffmpeg] listening on :${port}`));
