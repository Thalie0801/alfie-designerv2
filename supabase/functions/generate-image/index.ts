import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "../_shared/env.ts";

interface GenerateImageRequest {
  brandId?: unknown;
  prompt?: unknown;
  format?: unknown;
  ratio?: unknown;
  style?: unknown;
  metadata?: unknown;
}

interface SuccessResponse {
  orderId: string;
  jobId: string;
  status: "pending" | "processing";
  message: string;
}

interface ErrorResponse {
  error: string;
  orderId: null;
  status: "error";
}

function jsonResponse(payload: SuccessResponse | ErrorResponse, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getPromptSummary(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  return trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed", orderId: null, status: "error" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[generate-image] Missing Supabase configuration");
    return jsonResponse({ error: "server_misconfigured", orderId: null, status: "error" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return jsonResponse({ error: "unauthorized", orderId: null, status: "error" }, 401);
  }

  let body: GenerateImageRequest;
  try {
    body = (await req.json()) as GenerateImageRequest;
  } catch (error) {
    console.error("[generate-image] Invalid JSON payload", error);
    return jsonResponse({ error: "invalid_json", orderId: null, status: "error" }, 400);
  }

  const brandId = typeof body.brandId === "string" ? body.brandId : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const format = typeof body.format === "string" ? body.format : "image";
  const ratio = typeof body.ratio === "string" ? body.ratio : undefined;
  const style = typeof body.style === "string" ? body.style : undefined;
  const extraMetadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!brandId || !prompt) {
    return jsonResponse({ error: "invalid_body", orderId: null, status: "error" }, 400);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error("[generate-image] auth.getUser error", authError);
    return jsonResponse({ error: "unauthorized", orderId: null, status: "error" }, 401);
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, user_id, images_used, quota_images")
    .eq("id", brandId)
    .single();

  if (brandError) {
    console.error("[generate-image] brand fetch error", brandError);
    return jsonResponse({ error: "brand_fetch_failed", orderId: null, status: "error" }, 500);
  }

  if (!brand) {
    return jsonResponse({ error: "brand_not_found", orderId: null, status: "error" }, 404);
  }

  if (brand.user_id !== user.id) {
    console.warn("[generate-image] brand does not belong to user", {
      brandId,
      brandOwner: brand.user_id,
      userId: user.id,
    });
    return jsonResponse({ error: "forbidden", orderId: null, status: "error" }, 403);
  }

  const quotaLimit = typeof (brand as Record<string, unknown>).quota_images === "number"
    ? (brand as { quota_images: number }).quota_images
    : null;
  const imagesUsed = typeof (brand as Record<string, unknown>).images_used === "number"
    ? (brand as { images_used: number }).images_used
    : 0;

  if (quotaLimit !== null && quotaLimit > 0 && imagesUsed + 1 > quotaLimit) {
    return jsonResponse({ error: "quota_exceeded", orderId: null, status: "error" }, 403);
  }

  const now = new Date().toISOString();
  const campaignName = prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt || `Image_${Date.now()}`;

  const orderMetadata = {
    source: "generate-image",
    format,
    ratio,
    style,
    requestedAt: now,
    ...extraMetadata,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      brand_id: brandId,
      campaign_name: campaignName || `Image_${Date.now()}`,
      status: "visual_generation",
      brief_json: {
        prompt,
        format,
        ratio,
        style,
      },
      metadata: orderMetadata,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[generate-image] failed to create order", orderError);
    return jsonResponse({ error: "order_creation_failed", orderId: null, status: "error" }, 500);
  }

  const baseJobPayload = {
    prompt,
    format,
    ratio,
    style,
    metadata: {
      ...orderMetadata,
      orderId: order.id,
      userId: user.id,
      brandId,
      priority: 1,
    },
    history: [],
  };

  const { data: job, error: jobError } = await supabase
    .from("job_queue")
    .insert({
      user_id: user.id,
      brand_id: brandId,
      order_id: order.id,
      type: "copy",
      status: "pending",
      payload: baseJobPayload,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("[generate-image] failed to enqueue job", jobError);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return jsonResponse({ error: "job_enqueue_failed", orderId: null, status: "error" }, 500);
  }

  if (typeof imagesUsed === "number") {
    const { error: usageError } = await supabase
      .from("brands")
      .update({ images_used: imagesUsed + 1 })
      .eq("id", brandId);

    if (usageError) {
      console.warn("[generate-image] failed to increment images_used", usageError);
    }
  }

  const logPayload = {
    user_id: user.id,
    brand_id: brandId,
    type: "image",
    status: "pending",
    prompt_summary: getPromptSummary(prompt),
    metadata: {
      orderId: order.id,
      jobId: job.id,
      format,
      ratio,
      style,
      source: "generate-image",
    },
  };

  const { error: logError } = await supabase.from("generation_logs").insert(logPayload);
  if (logError) {
    console.warn("[generate-image] failed to insert generation log", logError);
  }

  const response: SuccessResponse = {
    orderId: order.id,
    jobId: job.id,
    status: "pending",
    message: "Generation queued",
  };

  return jsonResponse(response, 200);
});
