import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_FN_SECRET } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase service credentials");
    }

    if (INTERNAL_FN_SECRET) {
      const provided = req.headers.get("X-Internal-Secret");
      if (!provided || provided !== INTERNAL_FN_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const params = new URL(req.url).searchParams;
    const timeoutMinutes = Number(params.get("timeout")) || 15;
    const maxAttempts = Number(params.get("maxAttempts")) || 3;

    const { data, error } = await supabase.rpc("reset_stuck_jobs", {
      timeout_minutes: timeoutMinutes,
      max_attempts: maxAttempts,
    });

    if (error) {
      console.error("[job-queue-watchdog] reset_stuck_jobs failed", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = Array.isArray(data) ? data[0] : data;
    const resetCount = summary?.reset_count ?? 0;
    const failedCount = summary?.failed_count ?? 0;

    return new Response(
      JSON.stringify({
        ok: true,
        timeout_minutes: timeoutMinutes,
        max_attempts: maxAttempts,
        reset_count: resetCount,
        failed_count: failedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[job-queue-watchdog] fatal", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
