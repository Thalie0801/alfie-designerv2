// supabase/functions/generate-media/index.ts
// Crée un job dans la table "jobs" que le worker traitera.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, validateEnv } from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("[generate-media] ❌ Missing env vars", envValidation);
}

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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[generate-media] ❌ Supabase env missing", {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return new Response(JSON.stringify({ ok: false, error: "SUPABASE_ENV_MISSING" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rawBody = (await req.json()) as GenerateMediaPayload;
    console.log("[generate-media] Incoming body", rawBody);

    // Récupérer le JWT s’il existe
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // 🔹 Normalisation userId (body → intent → JWT)
    let userId = rawBody.userId ?? rawBody.user_id ?? rawBody.intent?.userId ?? rawBody.intent?.user_id;

    if (!userId && jwt) {
      // On récupère le user depuis le token (cas normal depuis Alfie / supabase-js)
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

    // 🔹 Création du job dans la table jobs
    const metadata: Record<string, unknown> = {
      user_id: userId,
      type: kind,
      count,
      ratio,
    };

    if (brandId) {
      metadata.brand_id = brandId;
    }

    const { data: job, error: insertError } = await supabaseAdmin
      .from("jobs")
      .insert({
        status: "queued",
        prompt,
        metadata,
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
