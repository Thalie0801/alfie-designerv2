import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IntentSchema = z.object({
  brandId: z.string().uuid(),
  format: z.enum(["image", "carousel"]),
  count: z.number().int().min(1).max(20),
  topic: z.string().min(3),
  ratio: z.enum(["1:1", "4:5", "9:16"]).optional(),
  platform: z.enum(["instagram", "linkedin", "tiktok"]).optional(),
});

const BodySchema = z.object({
  userId: z.string().uuid(),
  intent: IntentSchema,
});

type Intent = z.infer<typeof IntentSchema>;

type Json = Record<string, unknown>;

function respond(status: number, payload: Json) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { ok: false, error: "method_not_allowed" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[generate-media] Invalid JSON", error);
    return respond(400, { ok: false, error: "invalid_json" });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("[generate-media] Validation error", parsed.error.flatten());
    return respond(400, {
      ok: false,
      error: "invalid_body",
      details: parsed.error.flatten(),
    });
  }

  const { userId, intent } = parsed.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[generate-media] Missing Supabase credentials");
    return respond(500, { ok: false, error: "server_misconfigured" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, quota_images, images_used")
    .eq("id", intent.brandId)
    .single();

  if (brandError) {
    console.error("[generate-media] Brand fetch error", brandError);
    return respond(500, { ok: false, error: "brand_fetch_failed" });
  }

  if (!brand) {
    return respond(404, { ok: false, error: "brand_not_found" });
  }

  const imagesToConsume = intent.format === "carousel" ? intent.count : intent.count;
  const limit = typeof brand.quota_images === "number" ? brand.quota_images : 0;
  const used = typeof brand.images_used === "number" ? brand.images_used : 0;

  if (limit > 0 && used + imagesToConsume > limit * 1.1) {
    return respond(403, {
      ok: false,
      error: "quota_exceeded",
      message:
        "Tu as dépassé ton quota d'images pour ce mois. Réduis le nombre ou upgrade ton plan.",
    });
  }

  const campaignName = buildCampaignName(intent);

  const orderPayload: Record<string, unknown> = {
    user_id: userId,
    brand_id: intent.brandId,
    campaign_name: campaignName,
    status: "queued",
    brief_json: { intent },
    metadata: {
      source: "generate-media",
      format: intent.format,
    },
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select()
    .single();

  if (orderError || !order) {
    console.error("[generate-media] Order insert error", orderError);
    return respond(500, { ok: false, error: "order_creation_failed" });
  }

  const jobType = intent.format === "carousel" ? "render_carousels" : "render_images";
  const jobPayload = {
    user_id: userId,
    order_id: order.id,
    type: jobType,
    status: "queued",
    payload: { intent, orderId: order.id },
  };

  const { error: jobError } = await supabase.from("job_queue").insert(jobPayload);

  if (jobError) {
    console.error("[generate-media] Job queue insert error", jobError);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return respond(500, { ok: false, error: "job_enqueue_failed" });
  }

  return respond(200, { ok: true, data: { orderId: order.id } });
});

function buildCampaignName(intent: Intent): string {
  const base = intent.topic.trim();
  if (base.length >= 3) {
    return base.slice(0, 120);
  }
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  return `Commande Alfie ${date}`;
}
