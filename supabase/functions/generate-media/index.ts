// supabase/functions/generate-media/index.ts
// Crée un job dans la table "job_queue" que le worker traitera.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

// CORS local (plus de dépendance à ../_shared/cors)
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateMediaPayload {
  userId?: string;
  user_id?: string;
  brandId?: string;
  brand_id?: string;

  kind?: string;
  type?: string;
  format?: string;

  count?: number;
  slides?: number;

  ratio?: string;
  aspect_ratio?: string;

  prompt?: string;
  brief?: string;
  description?: string;

  intent?: {
    kind?: string;
    count?: number;
    ratio?: string;
    brief?: string;
    userId?: string;
    user_id?: string;
    brandId?: string;
    brand_id?: string;
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[generate-media] 🎯 BOOT PROJECT =", SUPABASE_URL?.includes("itsjon") ? "itsjonazifiiikozengd ✅" : SUPABASE_URL);
    console.log("[generate-media] Starting job creation", {
      timestamp: new Date().toISOString(),
      hasURL: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
    });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[generate-media] ❌ Supabase env missing");
      return new Response(JSON.stringify({ ok: false, error: "SUPABASE_ENV_MISSING" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[generate-media] 📊 Supabase Client Created");

    // 🔍 Verify connection and schema
    console.log("[generate-media] 🔍 Testing database connection and schema...");
    const { data: schemaTest, error: testError } = await supabaseAdmin
      .from("job_queue")
      .select("id,payload,status,type")
      .limit(1);
    
    if (testError) {
      console.error("[generate-media] ❌ Schema test failed:", {
        error: testError,
        message: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
        table: "job_queue"
      });
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "SCHEMA_TEST_FAILED",
        message: testError.message,
        code: testError.code
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.log("[generate-media] ✅ Schema validated - job_queue has required columns (id, payload, status, type)");
    }

    const rawBody = (await req.json()) as GenerateMediaPayload;
    console.log("[generate-media] Incoming body", rawBody);

    // Récupérer le JWT s’il existe
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // 🔹 Normalisation userId (body → intent → JWT)
    let userId = rawBody.userId ?? rawBody.user_id ?? rawBody.intent?.userId ?? rawBody.intent?.user_id;

    if (!userId && jwt) {
      const { data, error: authError } = await supabaseAdmin.auth.getUser(jwt);
      if (authError) {
        console.error("[generate-media] auth.getUser error", authError);
      } else if (data?.user) {
        userId = data.user.id;
      }
    }

    if (!userId) {
      console.error("[generate-media] Missing userId (body & JWT)");
      return new Response(JSON.stringify({ ok: false, error: "UNAUTHENTICATED_OR_NO_USER" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔹 Normalisation brandId (optionnel)
    const brandId = rawBody.brandId ?? rawBody.brand_id ?? rawBody.intent?.brandId ?? rawBody.intent?.brand_id;

    // 🔹 Type de génération
    const kind = rawBody.kind ?? rawBody.format ?? rawBody.type ?? rawBody.intent?.kind ?? "image";

    const count = rawBody.count ?? rawBody.slides ?? rawBody.intent?.count ?? 1;

    const ratio = rawBody.ratio ?? rawBody.aspect_ratio ?? rawBody.intent?.ratio ?? "1:1";

    const prompt = rawBody.prompt ?? rawBody.brief ?? rawBody.description ?? rawBody.intent?.brief ?? "";

    if (!prompt) {
      console.warn("[generate-media] Empty prompt", { userId, brandId });
    }

    console.log("[generate-media] 📊 Normalized intent", {
      userId,
      brandId,
      kind,
      count,
      ratio,
      prompt: prompt.substring(0, 50) + '...'
    });

    // 🔹 Créer un ordre pour tracer la demande
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        brand_id: brandId,
        campaign_name: prompt.substring(0, 100),
        status: "queued",
        brief_json: { prompt, kind, count, ratio }
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[generate-media] ❌ ORDER_INSERT_FAILED", orderError);
      return new Response(JSON.stringify({ ok: false, error: "ORDER_INSERT_FAILED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-media] ✅ Order created", { orderId: order.id });

    // 🔹 Création du job dans la table job_queue
    const payload: Record<string, unknown> = {
      userId,
      brandId,
      orderId: order.id,
      type: kind,
      count,
      ratio,
      prompt,
    };

    const { data: job, error: insertError } = await supabaseAdmin
      .from("job_queue")
      .insert({
        user_id: userId,
        brand_id: brandId,
        order_id: order.id,
        type: kind === "carousel" ? "render_carousels" : "render_images",
        kind,
        status: "queued",
        payload,
      })
      .select("id, user_id, type, status, created_at")
      .single();

    if (insertError || !job) {
      console.error("[generate-media] ❌ JOB_INSERT_FAILED", {
        error: insertError,
        message: insertError?.message,
        code: insertError?.code,
        details: insertError?.details,
        hint: insertError?.hint,
        payload_sent: payload
      });
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "JOB_INSERT_FAILED",
        message: insertError?.message || "Failed to create job",
        code: insertError?.code,
        details: insertError?.details
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-media] ✅ Job created", {
      jobId: job.id,
      orderId: order.id,
      userId,
      brandId,
      kind,
      count,
      jobType: kind === "carousel" ? "render_carousels" : "render_images",
      targetTable: "job_queue"
    });

    // 🚀 Déclencher le worker immédiatement
    console.log("[generate-media] 🔄 Invoking alfie-job-worker...");
    try {
      const { error: workerError } = await supabaseAdmin.functions.invoke("alfie-job-worker", {
        body: { trigger: "generate-media", jobId: job.id, orderId: order.id }
      });
      
      if (workerError) {
        console.error("[generate-media] ⚠️ Worker invoke failed:", workerError);
      } else {
        console.log("[generate-media] ✅ Worker invoked successfully");
      }
    } catch (workerErr) {
      console.error("[generate-media] ⚠️ Worker invoke error:", workerErr);
    }

    return new Response(JSON.stringify({ ok: true, jobId: job.id, orderId: order.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[generate-media] ❌ Uncaught error", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "INTERNAL_ERROR",
        message: err?.message ?? String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
