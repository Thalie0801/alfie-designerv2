import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { isAdminUser, getUserRoles } from "../_shared/auth.ts";
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

function userEmailFromAuth(authData: { user?: { email?: string | null } } | null | undefined) {
  return authData?.user?.email?.toLowerCase() ?? null;
}

Deno.serve(async (req: Request) => {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[generate-media] Missing Supabase credentials");
    return respond(500, { ok: false, error: "server_misconfigured" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const userIdForLogging = z.string().uuid().safeParse((body as any)?.userId).success
    ? ((body as Record<string, unknown>)?.userId as string)
    : null;
  const brandIdFromPayload = (body as Record<string, any>)?.intent?.brandId;

  let userEmail = "";
  let authUserResponse = null as Awaited<ReturnType<typeof supabase.auth.admin.getUserById>> | null;

  if (userIdForLogging) {
    const authResponse = await supabase.auth.admin.getUserById(userIdForLogging);
    authUserResponse = authResponse;
    userEmail = userEmailFromAuth(authResponse.data) ?? "";
  }

  if (!brandIdFromPayload) {
    console.error(
      `[generate-media] missing brandId in payload for user ${userEmail || userIdForLogging || "unknown-user"}`,
    );
    return respond(400, { ok: false, error: "missing_brand_id" });
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

  console.log("[generate-media] received intent", {
    userId,
    brandId: intent.brandId,
    format: intent.format,
    count: intent.count,
  });

  if (intent.format === "image" || intent.format === "carousel") {
    console.log(
      `[generate-media] start image generation for user=${userEmail || userId} brand=${intent.brandId}`,
    );
  }

  const { data: authUserData } = authUserResponse ?? (await supabase.auth.admin.getUserById(userId));
  userEmail = userEmailFromAuth(authUserData) ?? userEmail;
  const roleRows = await getUserRoles(supabase, userId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, granted_by_admin")
    .eq("id", userId)
    .maybeSingle();

  const isAdmin = isAdminUser(userEmail, roleRows, {
    plan: profile?.plan,
    grantedByAdmin: profile?.granted_by_admin,
    logContext: "quota",
  });

  if (isAdmin) {
    console.log(`[quota] admin bypass applied for ${userEmail || "unknown-email"}`);
  }

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

  if (!isAdmin && limit > 0 && used + imagesToConsume > limit * 1.1) {
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

  console.log(`[generate-media] created order ${order.id}`);

  const jobType = intent.format === "carousel" ? "render_carousels" : "render_images";
  const jobPayload = {
    user_id: userId,
    order_id: order.id,
    type: jobType,
    status: "queued",
    payload: {
      userId,
      userEmail,
      brandId: intent.brandId,
      orderId: order.id,
      format: intent.format,
      brief: {
        briefs: [{
          content: intent.topic,
          format: `${intent.ratio || "4:5"} ${intent.format}`,
          objective: `Generate ${intent.count} ${intent.format}(s)`,
          style: "professional",
          numSlides: intent.format === "carousel" ? intent.count : 1,
        }]
      }
    },
  };

  const { data: jobRows, error: jobError } = await supabase
    .from("job_queue")
    .insert(jobPayload)
    .select("id")
    .single();

  if (jobError) {
    console.error("[generate-media] Job queue insert error", jobError);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return respond(500, { ok: false, error: "job_enqueue_failed" });
  }

  console.log(
    `[generate-media] enqueued job ${jobRows?.id} type=${jobType} brand=${intent.brandId} for order=${order.id}`,
  );

  try {
    console.log("[generate-media] invoking alfie-job-worker after enqueue");
    await supabase.functions.invoke("alfie-job-worker", {
      body: { trigger: "image_enqueue", orderId: order.id, jobId: jobRows?.id ?? null },
    });
  } catch (invokeError) {
    console.error("[generate-media] failed to invoke alfie-job-worker", invokeError);
  }

  return respond(200, {
    ok: true,
    data: {
      orderId: order.id,
      jobId: jobRows?.id ?? null,
      summary: {
        format: intent.format,
        count: intent.count,
        status: "queued",
      },
    },
  });
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
