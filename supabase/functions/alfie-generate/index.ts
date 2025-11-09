// supabase/functions/alfie-generate/index.ts
import { ok, fail, cors } from "../_shared/http.ts";
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_ORIGINS = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

cloudinary.config({
  cloud_name: Deno.env.get("CLOUDINARY_CLOUD_NAME")!,
  api_key: Deno.env.get("CLOUDINARY_API_KEY")!,
  api_secret: Deno.env.get("CLOUDINARY_API_SECRET")!,
});

const RATIO_MAP = {
  "1:1": { width: 1024, height: 1024, ar: "1:1" },
  "9:16": { width: 1024, height: 1820, ar: "9:16" },
  "16:9": { width: 1536, height: 864, ar: "16:9" },
  "3:4": { width: 1024, height: 1365, ar: "3:4" },
} as const;

const Input = z.object({
  brandId: z.string().min(1),
  mode: z.enum(["image", "carousel", "video"]).default("image"),
  ratio: z.enum(["1:1", "9:16", "16:9", "3:4"]).default("1:1"),
  prompt: z.string().min(2),
  count: z.number().int().positive().max(12).default(1),
  slidesPerCarousel: z.number().int().positive().max(10).default(5),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().startsWith("data:").optional(),
  slides: z
    .array(
      z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        bgUrl: z.string().url().optional(),
      })
    )
    .optional(),
});

function toDataSvg(width: number, height: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`;
  const b64 = btoa(svg);
  return `data:image/svg+xml;base64,${b64}`;
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED_ORIGINS);

  if (req.method === "OPTIONS") {
    return ok({ preflight: true }, headers);
  }

  if (req.method !== "POST") {
    return fail(405, "Method not allowed", null, headers);
  }

  try {
    const json = await req.json().catch(() => null);
    if (!json) {
      return fail(400, "Invalid JSON body", null, headers);
    }

    const parsed = Input.safeParse(json);
    if (!parsed.success) {
      return fail(400, "Validation error", parsed.error.flatten(), headers);
    }

    const { brandId, mode, ratio, prompt, imageUrl, imageBase64 } = parsed.data;
    const cfg = RATIO_MAP[ratio] ?? RATIO_MAP["1:1"];

    if (mode === "image") {
      const cloud = cloudinary.config().cloud_name!;
      let source: string;

      if (imageUrl) {
        const encoded = encodeURIComponent(imageUrl);
        source = `https://res.cloudinary.com/${cloud}/image/fetch/ar_${cfg.ar},c_fill,q_auto,f_auto/${encoded}`;
      } else if (imageBase64) {
        source = imageBase64;
      } else {
        source = toDataSvg(cfg.width, cfg.height);
      }

      const uploaded = await cloudinary.uploader.upload(source, {
        folder: `alfie/${brandId}/images/${ratio}`,
        resource_type: "image",
        tags: ["alfie", "generated", ratio],
        context: { prompt },
      });

      if (!uploaded?.secure_url) {
        return fail(502, "Upload Cloudinary sans secure_url", uploaded, headers);
      }

      return ok({ imageUrl: uploaded.secure_url, ratio }, headers);
    }

    if (mode === "carousel") {
      const jobId = crypto.randomUUID();
      return new Response(JSON.stringify({ ok: true, jobId }), {
        status: 202,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    if (mode === "video") {
      const jobId = crypto.randomUUID();
      return new Response(JSON.stringify({ ok: true, jobId }), {
        status: 202,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    return fail(400, "Mode non supporté", { mode }, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, "alfie-generate failed", message, headers);
  }
});
