// supabase/functions/generate-media/index.ts
// Crée un job dans la table "jobs" que le worker traitera ensuite.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2?target=deno";

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, validateEnv } from "../_shared/env.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // TODO: restreindre en prod
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("[generate-media] ❌ Missing env vars", envValidation);
}

serve(async (req: Request): Promise<Response> => {
  // Préflight
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
    const supabaseUrl = SUPABASE_URL;
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("[generate-media] ❌ Missing Supabase env", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: "SUPABASE_ENV_MISSING",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rawBody = await req.json();
    console.log("[generate-media] Incoming body", rawBody);

    // 🔹 Normalisation des champs (camelCase + snake_case)
    const userId: string | undefined = rawBody.userId ?? rawBody.user_id;
    const brandId: string | undefined = rawBody.brandId ?? rawBody.brand_id;

    const kind: string = rawBody.kind ?? rawBody.format ?? rawBody.type ?? rawBody.intent?.kind ?? "image";

    const count: number = rawBody.count ?? rawBody.slides ?? rawBody.intent?.count ?? 1;

    const ratio: string = rawBody.ratio ?? rawBody.aspect_ratio ?? rawBody.intent?.ratio ?? "1:1";

    const prompt: string = rawBody.prompt ?? rawBody.brief ?? rawBody.description ?? rawBody.intent?.brief ?? "";

    if (!userId || !brandId) {
      console.error("[generate-media] ❌ Missing userId or brandId", {
        userId,
        brandId,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: "MISSING_USER_OR_BRAND",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!prompt) {
      console.warn("[generate-media] ⚠️ Empty prompt", { userId, brandId });
    }

    console.log("[generate-media] Normalized intent", {
      userId,
      brandId,
      kind,
      count,
      ratio,
    });

    // 🔹 Métadonnées supplémentaires (pour le worker/logs)
    const metadata = {
      user_id: userId,
      brand_id: brandId,
      type: kind,
      count,
      ratio,
      prompt,
      // tu peux rajouter d'autres champs
    };

    // 🔹 Création du job dans la table "jobs"
    const { data: job, error: insertError } = await supabaseAdmin
      .from("jobs")
      .insert({
        user_id: userId,
        brand_id: brandId,
        type: kind, // "image", "video", "carousel", etc.
        status: "queued",
        prompt,
        metadata,
        // job_set_id, index_in_set... → laissent les defaults
      })
      .select("*")
      .single();

    if (insertError || !job) {
      console.error("[generate-media] ❌ Error inserting job", insertError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "JOB_INSERT_FAILED",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[generate-media] ✅ Job created", {
      jobId: job.id,
      userId,
      brandId,
      kind,
      count,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        jobId: job.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
