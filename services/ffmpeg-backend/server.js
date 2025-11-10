import express from "express";
import ffmpeg from "fluent-ffmpeg";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/**
 * Minimal concat from one image → looped mp4 (placeholder but functional)
 * POST /image-to-video { imageUrl, durationSec, ar } → mp4 url (stdout piping disabled on Render, just write file)
 */
app.post("/image-to-video", async (req, res) => {
  try {
    const { imageUrl, durationSec = 10, ar = "9:16" } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });

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

    // In real usage: upload `out` to S3/Cloudinary then return that URL.
    res.json({ ok: true, file: out });
  } catch (e) {
    res.status(500).json({ error: e?.message || "ffmpeg error" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`[ffmpeg] listening on :${port}`));
