import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod";
import { cors, fail, ok } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const Input = z
  .object({
    prompt: z.string().min(2),
    brandId: z.string().min(1),
    mode: z.enum(["image", "video"]).default("image"),
    ratio: z.enum(["1:1", "9:16", "16:9", "3:4"]).default("1:1"),
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().startsWith("data:").optional(),
  })
  .refine(
    (value) => value.imageUrl || value.imageBase64 || value.mode === "image",
    { message: "Provide imageUrl or imageBase64 for overlays" },
  );

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED);
  if (req.method === "OPTIONS") return ok({ preflight: true }, headers);

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("health") === "1") {
    return ok({ health: "up" }, headers);
  }

  if (req.method !== "POST") return fail(405, "Method not allowed", null, headers);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return fail(500, "Missing Supabase configuration", null, headers);
  }

  try {
    const json = await req.json().catch(() => null);
    if (!json) return fail(400, "Invalid JSON body", null, headers);
    const parsed = Input.safeParse(json);
    if (!parsed.success) {
      return fail(400, "Validation error", parsed.error.flatten(), headers);
    }

    const { prompt, brandId, mode, ratio, imageUrl, imageBase64 } = parsed.data;

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return fail(401, "Missing access token", null, headers);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userRes, error: userErr } = await supa.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return fail(401, "Unauthenticated", userErr?.message, headers);
    }
    const userId = userRes.user.id;

    const payload = {
      prompt,
      brandId,
      mode,
      ratio,
      imageUrl,
      imageBase64,
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

    return ok({ orderId: order.id, jobId: job.id }, headers, 202);
  } catch (e) {
    return fail(
      500,
      "alfie-generate crashed",
      e instanceof Error ? e.message : String(e),
      headers,
    );
  }
});
