// supabase/functions/alfie-generate/index.ts
import { ok, fail, cors } from "../_shared/http.ts"; // helpers déjà vus
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";

const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME") ?? "";

const RATIO_MAP = {
  "1:1": { width: 1024, height: 1024, ar: "1:1" },
  "9:16": { width: 1024, height: 1820, ar: "9:16" },
  "16:9": { width: 1536, height: 864, ar: "16:9" },
  "3:4": { width: 1024, height: 1365, ar: "3:4" },
} as const;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ALLOWED = ["https://lovable.dev","https://*.lovable.app","http://localhost:5173","http://127.0.0.1:5173"];

cloudinary.config({
  cloud_name: Deno.env.get("CLOUDINARY_CLOUD_NAME")!,
  api_key: Deno.env.get("CLOUDINARY_API_KEY")!,
  api_secret: Deno.env.get("CLOUDINARY_API_SECRET")!,
});

const RATIO_MAP = {
  "1:1":  { width: 1024, height: 1024, ar: "1:1"  },
  "9:16": { width: 1024, height: 1820, ar: "9:16" },
  "16:9": { width: 1536, height: 864,  ar: "16:9" },
  "3:4":  { width: 1024, height: 1365, ar: "3:4"  },
} as const;

const Input = z.object({
  brandId: z.string().min(1),
  mode: z.enum(["image","carousel","video"]).default("image"),
  ratio: z.enum(["1:1","9:16","16:9","3:4"]).default("1:1"),
  prompt: z.string().min(2),
  count: z.number().int().positive().max(12).default(1),
  slidesPerCarousel: z.number().int().positive().max(10).default(5),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().startsWith("data:").optional(),
  slides: z.array(z.object({ title:z.string(), subtitle:z.string().optional(), bgUrl:z.string().url().optional()})).optional()
});

async function uploadToCloudinary(file: string, folder: string, tags: string[] = [], context: Record<string,string> = {}) {
  const res = await cloudinary.uploader.upload(file, { folder, resource_type: "image", tags, context });
  if (!res?.secure_url) throw new Error("Upload Cloudinary sans secure_url");
  return { url: res.secure_url, publicId: res.public_id };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED);
  if (req.method === "OPTIONS") return ok({ preflight: true }, headers);
  if (req.method !== "POST") return fail(405, "Method not allowed", null, headers);

  try {
    const json = await req.json().catch(() => null);
    if (!json) return fail(400, "Invalid JSON body", null, headers);
    const p = Input.safeParse(json);
    if (!p.success) return fail(400, "Validation error", p.error.flatten(), headers);

    const { brandId, mode, ratio, prompt, count, slidesPerCarousel, imageUrl, imageBase64, slides } = p.data;
    const cfg = RATIO_MAP[ratio] ?? RATIO_MAP["1:1"];
    const folderBase = `alfie/${brandId}`;

    // IMAGE (sync simple: fetch/overlay minimal) — à brancher à ton provider si besoin
    if (mode === "image") {
      // Si image d'entrée en URL → normaliser AR via transformation fetch Cloudinary
      const fetchUrl = imageUrl
        ? `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/fetch/ar_${cfg.ar},c_fill,q_auto,f_auto/${encodeURIComponent(imageUrl)}`
        : (imageBase64 ?? `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='${cfg.width}' height='${cfg.height}'/>`)});

      const uploaded = await uploadToCloudinary(fetchUrl, `${folderBase}/images/${ratio}`, ["alfie","generated",ratio], { prompt });
      return ok({ imageUrl: uploaded.url, ratio }, headers);
    }

    const { prompt, brandId, mode, ratio, imageUrl, imageBase64 } = parsed.data;
    const cfg = RATIO_MAP[ratio] ?? RATIO_MAP["1:1"];

    const transformedImageUrl = imageUrl
      ? CLOUDINARY_CLOUD_NAME
        ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/ar_${cfg.ar},c_fill,q_auto,f_auto/${encodeURIComponent(imageUrl)}`
        : imageUrl
      : undefined;

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return fail(401, "Missing access token", null, headers);
    // CAROUSEL (async): une exécution MediaFlow peut être plus appropriée — ici on simule un enqueuing → 202
    if (mode === "carousel") {
      // Enqueue côté DB/worker ici si tu as déjà le mécanisme, sinon appelle ton MediaFlow depuis une autre Edge
      // Retourne un jobId (ici simulé)
      const jobId = crypto.randomUUID();
      return new Response(JSON.stringify({ jobId }), { status: 202, headers: { ...headers, "content-type":"application/json" }});
    }

    // VIDEO → toujours asynchrone, renvoyer 202
    if (mode === "video") {
      const jobId = crypto.randomUUID();
      return new Response(JSON.stringify({ jobId }), { status: 202, headers: { ...headers, "content-type":"application/json" }});
    }
    const userId = userRes.user.id;

    const payload = {
      prompt,
      brandId,
      mode,
      ratio,
      imageUrl: transformedImageUrl,
      imageBase64,
      width: cfg.width,
      height: cfg.height,
      aspectRatio: cfg.ar,
    };

    const { data: order, error: orderError } = await supa
      .from("orders")
      .insert({
        user_id: userId,
        brand_id: brandId,
        status: "pending",
        source: "studio",
        meta: payload,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return fail(400, "Order creation failed", orderError?.message, headers);
    }

    const { data: job, error: jobError } = await supa
      .from("job_queue")
      .insert({
        order_id: order.id,
        user_id: userId,
        type: mode === "video" ? "generate_video" : "generate_image",
        status: "pending",
        attempts: 0,
        payload,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return fail(400, "Job enqueue failed", jobError?.message, headers);
    }

    // TODO: appelle ton provider (nano banana / openai / etc.)
    // const result = await providerGenerate({ prompt, brandId, ratio, imageUrl, imageBase64 });
    // if (result.async) return new Response(JSON.stringify({ jobId: result.jobId }), { status: 202, headers });

    // Simu: renvoyer 200 avec imageUrl si ok
    // if (!result?.imageUrl) return fail(502, "Provider returned no imageUrl", result, headers);
    // return ok({ imageUrl: result.imageUrl }, headers);

    return fail(400, "Mode non supporté", { mode }, headers);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(500, "alfie-generate failed", msg, headers);
  }
});
