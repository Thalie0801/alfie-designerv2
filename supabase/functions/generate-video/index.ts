import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const REPLICATE_API = "https://api.replicate.com/v1/predictions";
const DEFAULT_REPLICATE_MODEL_VERSION = "minimax/video-01"; // Remplace par le hash/slug exact
const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const KIE_TOKEN = Deno.env.get("KIE_API_KEY");
const REPLICATE_MODEL_VERSION =
  Deno.env.get("REPLICATE_VIDEO_MODEL_VERSION") ?? DEFAULT_REPLICATE_MODEL_VERSION;
const DEFAULT_FFMPEG_BACKEND_URL = "https://alfie-ffmpeg-backend.onrender.com";

const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...(init ?? {}),
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });

const MEDIA_URL_KEYS = [
  "videoUrl",
  "video_url",
  "url",
  "output",
  "outputUrl",
  "output_url",
  "downloadUrl",
  "download_url",
  "resultUrl",
  "result_url",
  "fileUrl",
  "file_url"
] as const;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const extractMediaUrl = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.startsWith("http") ? trimmed : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const extracted = extractMediaUrl(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (isRecord(payload)) {
    for (const key of MEDIA_URL_KEYS) {
      if (key in payload) {
        const extracted = extractMediaUrl(payload[key]);
        if (extracted) return extracted;
      }
    }

    if ("data" in payload) {
      const extracted = extractMediaUrl(payload.data);
      if (extracted) return extracted;
    }

    if ("result" in payload) {
      const extracted = extractMediaUrl((payload as UnknownRecord).result);
      if (extracted) return extracted;
    }
  }

  return null;
};

const collectStatusUrls = (payload: unknown): string[] => {
  if (!isRecord(payload)) return [];

  const urls = new Set<string>();
  const append = (value: unknown) => {
    if (typeof value === "string" && value.trim().startsWith("http")) {
      urls.add(value.trim());
    }
  };

  const statusFields = [
    "statusUrl",
    "status_url",
    "pollUrl",
    "poll_url",
    "resultUrl",
    "result_url",
    "progressUrl",
    "progress_url"
  ];

  for (const field of statusFields) {
    if (field in payload) {
      append(payload[field]);
    }
  }

  const listFields = ["statusUrls", "status_urls"];
  for (const field of listFields) {
    const candidate = payload[field];
    if (Array.isArray(candidate)) {
      for (const item of candidate) append(item);
    }
  }

  return Array.from(urls);
};

const readStatusString = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const statusValue = payload.status ?? payload.state;
  return typeof statusValue === "string" ? statusValue : null;
};

const getBackendBaseUrl = () => {
  const configured = Deno.env.get("FFMPEG_BACKEND_URL") ?? DEFAULT_FFMPEG_BACKEND_URL;
  return configured.replace(/\/$/, "");
};

const buildBackendHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = Deno.env.get("FFMPEG_BACKEND_API_KEY");
  const bearer = Deno.env.get("FFMPEG_BACKEND_BEARER") ?? Deno.env.get("FFMPEG_BACKEND_BEARER_TOKEN");
  const customHeaderName = Deno.env.get("FFMPEG_BACKEND_AUTH_HEADER");
  const customHeaderValue = Deno.env.get("FFMPEG_BACKEND_AUTH_VALUE");

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  if (bearer) {
    headers["Authorization"] = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  }

  if (customHeaderName && customHeaderValue) {
    headers[customHeaderName] = customHeaderValue;
  }

  return headers;
};

type ProviderResolution = {
  display: string;
  api: string;
  engine?: "sora" | "seededance" | "kling";
};

const resolveProvider = (raw?: string): ProviderResolution => {
  const normalized = (raw ?? "replicate").toLowerCase();

  if (normalized === "replicate" || normalized === "seededance") {
    return { display: "seededance", api: "replicate", engine: "seededance" };
  }

  if (normalized === "sora") {
    return { display: "sora", api: "kling", engine: "sora" };
  }

  if (normalized === "kling") {
    return { display: "kling", api: "kling", engine: "kling" };
  }

  if (normalized === "animate" || normalized === "ffmpeg-backend") {
    return { display: "animate", api: "animate" };
  }

  return { display: normalized, api: normalized };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt : undefined;
    const aspectRatio = typeof body?.aspectRatio === "string" ? body.aspectRatio : "16:9";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : undefined;
    const publicBaseUrl = typeof body?.publicBaseUrl === "string" ? body.publicBaseUrl : undefined;
    const generationId = typeof body?.generationId === "string" ? body.generationId : undefined;
    const jobId = typeof body?.jobId === "string" ? body.jobId : undefined;

    const providerRaw = typeof body?.provider === "string" ? body.provider : undefined;
    const providerResolution = resolveProvider(providerRaw);
    const providerDisplay = providerResolution.display;
    const providerApi = providerResolution.api;
    const providerEngine = providerResolution.engine;
    const provider = (providerRaw ?? "replicate").toLowerCase();
    const normalizedProvider = provider === "sora" ? "kling" : provider;

    const isStatusCheck = !!(generationId || jobId) && !prompt;

    if (!isStatusCheck && (!prompt || typeof prompt !== "string")) {
      return jsonResponse({ error: "Missing prompt" }, { status: 400 });
    }

    if (isStatusCheck) {
      const lookupId = generationId ?? jobId;
      if (!lookupId) {
        return jsonResponse({ error: "Missing generationId" }, { status: 400 });
      }

      if (providerApi === "replicate") {
      if (normalizedProvider === "replicate") {
        if (!REPLICATE_TOKEN) {
          throw new Error("Missing REPLICATE_API_TOKEN");
        }

        const response = await fetch(`${REPLICATE_API}/${lookupId}`, {
          headers: {
            Authorization: `Token ${REPLICATE_TOKEN}`,
            "Content-Type": "application/json"
          }
        });

        const data = await response.json();
        if (!response.ok) {
          const detail = typeof data?.detail === "string" ? data.detail : "Replicate error";
          return jsonResponse({ error: detail }, { status: 500 });
        }

        return jsonResponse({
          id: data.id ?? lookupId,
          provider: providerDisplay,
          providerInternal: providerApi,
          providerEngine,
          provider: provider,
          status: data.status ?? data.state ?? "processing",
          output: data.output ?? null,
          logs: data.logs ?? undefined,
          error: data.error ?? undefined
        });
      }

      if (providerApi === "kling") {
      if (normalizedProvider === "kling") {
        if (!KIE_TOKEN) {
          throw new Error("Missing KIE_API_KEY");
        }

        const response = await fetch(`https://api.kie.ai/v1/video/${lookupId}`, {
          headers: {
            Authorization: `Bearer ${KIE_TOKEN}`,
            "Content-Type": "application/json"
          }
        });

        const data = await response.json();
        if (!response.ok) {
          const message = typeof data?.message === "string" ? data.message : "Kling error";
          return jsonResponse({ error: message }, { status: 500 });
        }

        const output = Array.isArray(data?.output)
          ? data.output[0]
          : data?.output ?? data?.video_url ?? data?.url ?? null;

        return jsonResponse({
          id: data?.id ?? lookupId,
          provider: providerDisplay,
          providerInternal: providerApi,
          providerEngine,
          provider: provider,
          status: data?.status ?? data?.state ?? "processing",
          output,
          metadata: data
        });
      }

      if (providerApi === "animate") {
        const baseUrl = getBackendBaseUrl();
        const endpoints = [
          `${baseUrl}/api/jobs/${lookupId}`,
          `${baseUrl}/api/status/${lookupId}`,
          `${baseUrl}/jobs/${lookupId}`,
          `${baseUrl}/status/${lookupId}`
        ];

        let lastError: { status: number; payload: unknown } | null = null;

        for (const url of endpoints) {
          const response = await fetch(url, { headers: buildBackendHeaders() });
          const text = await response.text();
          let parsed: unknown = undefined;

          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch (_) {
              parsed = text;
            }
          }

          if (response.status === 404) {
            continue;
          }

          if (response.ok) {
            const output = extractMediaUrl(parsed);
            const statusString = readStatusString(parsed) ?? (output ? "succeeded" : "processing");
            const statusUrls = collectStatusUrls(parsed);

            return jsonResponse({
              id: lookupId,
              provider: providerDisplay,
              providerInternal: providerApi,
              providerEngine,
              status: statusString,
              output,
              metadata: isRecord(parsed) ? parsed : undefined,
              statusUrls: statusUrls.length ? statusUrls : undefined
            });
          }

          lastError = { status: response.status, payload: parsed };
          break;
        }

        if (lastError) {
          return jsonResponse(
            {
              error: "Animate backend error",
              details: lastError.payload
            },
            { status: lastError.status }
          );
        }

        return jsonResponse({ error: "Animate job not found" }, { status: 404 });
      }

      return jsonResponse({ error: "Unknown provider" }, { status: 400 });
    }

    if (providerApi === "replicate") {
      return jsonResponse({ error: "Unknown provider" }, { status: 400 });
    }

    if (normalizedProvider === "replicate") {
      if (!REPLICATE_TOKEN) {
        throw new Error("Missing REPLICATE_API_TOKEN");
      }

      const rawBaseUrl: string | undefined = publicBaseUrl ?? Deno.env.get("PUBLIC_BASE_URL") ?? undefined;
      const sanitizedBase = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : undefined;
      const webhookUrl = sanitizedBase ? `${sanitizedBase}/functions/v1/video-webhook` : undefined;

      const response = await fetch(REPLICATE_API, {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=60"
        },
        body: JSON.stringify({
          version: REPLICATE_MODEL_VERSION,
          input: {
            prompt,
            aspect_ratio: aspectRatio,
            image: imageUrl || undefined
          },
          webhook: webhookUrl,
          webhook_events_filter: ["completed", "failed"]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : "Replicate error";
        return jsonResponse({ error: detail }, { status: 500 });
      }

      const id = data.id ?? data.prediction?.id ?? null;
      const status: string = data.status ?? "processing";

      return jsonResponse({
        id,
        provider: providerDisplay,
        providerInternal: providerApi,
        providerEngine,
        provider,
        jobId: id,
        jobShortId: id ? String(id).slice(0, 8) : null,
        status,
        metadata: {
          provider: providerDisplay,
          providerInternal: providerApi,
          provider,
          modelVersion: REPLICATE_MODEL_VERSION
        }
      });
    }

    if (providerApi === "kling") {
    if (normalizedProvider === "kling") {
      if (!KIE_TOKEN) {
        throw new Error("Missing KIE_API_KEY");
      }

      const response = await fetch("https://api.kie.ai/v2-1/kling/text-to-video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          resolution: aspectRatio === "9:16" ? "1080x1920" : "1920x1080",
          duration: 6,
          image_url: imageUrl || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const message = typeof data?.message === "string" ? data.message : "Kling error";
        return jsonResponse({ error: message }, { status: 500 });
      }

      const jobId = data.jobId ?? data.id ?? data.task_id ?? null;
      return jsonResponse({
        id: jobId,
        provider: providerDisplay,
        providerInternal: providerApi,
        providerEngine,
        jobId,
        jobShortId: jobId ? String(jobId).slice(0, 8) : null,
        status: "processing",
        metadata: { provider: providerDisplay, providerInternal: providerApi }
        provider,
        jobId,
        jobShortId: jobId ? String(jobId).slice(0, 8) : null,
        status: "processing",
        metadata: { provider }
      });
    }

    if (providerApi === "animate") {
      const baseUrl = getBackendBaseUrl();
      const endpoints = [
        `${baseUrl}/api/generate`,
        `${baseUrl}/generate`,
        `${baseUrl}/v1/generate`
      ];

      const payload: UnknownRecord = {};
      if (isRecord(body)) {
        for (const [key, value] of Object.entries(body)) {
          if (["provider", "publicBaseUrl", "generationId", "jobId"].includes(key)) continue;
          payload[key] = value;
        }
      }

      if (prompt) payload.prompt = prompt;
      payload.aspectRatio = aspectRatio;
      if (imageUrl) payload.imageUrl = imageUrl;

      for (const url of endpoints) {
        const response = await fetch(url, {
          method: "POST",
          headers: buildBackendHeaders(),
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        let parsed: unknown = undefined;

        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch (_) {
            parsed = text;
          }
        }

        if (response.ok) {
          const output = extractMediaUrl(parsed);
          const statusString = readStatusString(parsed) ?? (output ? "succeeded" : "processing");
          const statusUrls = collectStatusUrls(parsed);
          const jobIdentifier =
            (isRecord(parsed) && typeof parsed.jobId === "string" && parsed.jobId) ||
            (isRecord(parsed) && typeof parsed.job_id === "string" && parsed.job_id) ||
            (isRecord(parsed) && typeof parsed.id === "string" && parsed.id) ||
            (isRecord(parsed) && typeof (parsed as UnknownRecord).taskId === "string" && (parsed as UnknownRecord).taskId) ||
            (isRecord(parsed) && typeof (parsed as UnknownRecord).task_id === "string" && (parsed as UnknownRecord).task_id) ||
            null;

          return jsonResponse({
            id: jobIdentifier,
            provider: providerDisplay,
            providerInternal: providerApi,
            providerEngine,
            jobId: jobIdentifier,
            jobShortId: jobIdentifier ? String(jobIdentifier).slice(0, 8) : null,
            status: statusString,
            output,
            statusUrls: statusUrls.length ? statusUrls : undefined,
            metadata: isRecord(parsed) ? parsed : undefined
          });
        }

        if (response.status !== 404) {
          const errorMessage =
            (isRecord(parsed) && typeof parsed.error === "string" && parsed.error) ||
            (typeof parsed === "string" && parsed) ||
            text ||
            `Animate backend error (${response.status})`;

          return jsonResponse(
            { error: errorMessage, status: response.status, raw: parsed ?? text },
            { status: response.status }
          );
        }
      }

      return jsonResponse({ error: "Animate backend unreachable" }, { status: 502 });
    }

    return jsonResponse({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    console.error("generate-video error", error);
    const message = error instanceof Error ? error.message : "Server error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
