// supabase/functions/generate-media/index.ts
// Crée un job dans la table "jobs" que le worker traitera.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

serve(async (req: Request): Promise<Response> => {
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
    // 🔐 Récup des env Supabase directement (sans _shared/env)
    const supabaseUrl = Deno.env.get("ALFIE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("ALFIE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[generate-media] ❌ Supabase env missing", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
      });
      return new Response(JSON.stringify({ ok: false, error: "SUPABASE_ENV_MISSING" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    console.log("[generate-media] Normalized intent", {
      userId,
      brandId,
      kind,
      count,
      ratio,
    });

    // 🔹 Création du job dans la table job_queue
    const payload: Record<string, unknown> = {
      userId,
      brandId,
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
        type: kind === "carousel" ? "render_carousels" : "render_images",
        kind,
        status: "queued",
        payload,
      })
      .select("*")
      .single();

    if (insertError || !job) {
      console.error("[generate-media] ❌ JOB_INSERT_FAILED", insertError);
      return new Response(JSON.stringify({ ok: false, error: "JOB_INSERT_FAILED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-media] ✅ Job created", {
      jobId: job.id,
      userId,
      brandId,
      kind,
      count,
    });

    return new Response(JSON.stringify({ ok: true, jobId: job.id }), {
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
