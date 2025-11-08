import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, INTERNAL_FN_SECRET, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !INTERNAL_FN_SECRET) {
      throw new Error("Missing environment configuration");
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[trigger-job-worker] Manual trigger by user ${user.id}`);

    let watchdogSummary: { reset_count: number; failed_count: number } | null = null;
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: watchdogData, error: watchdogError } = await adminClient
        .rpc('reset_stuck_jobs', { timeout_minutes: 10, max_attempts: 3 });
      if (watchdogError) {
        console.error('[trigger-job-worker] reset_stuck_jobs failed:', watchdogError);
      } else if (watchdogData) {
        const summary = Array.isArray(watchdogData) ? watchdogData[0] : watchdogData;
        watchdogSummary = {
          reset_count: summary?.reset_count ?? 0,
          failed_count: summary?.failed_count ?? 0,
        };
      }
    }


    // Check if there are jobs to process
    const { count } = await supabase
      .from("job_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: "No jobs to process",
          jobsQueued: 0,
          watchdog: watchdogSummary,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[trigger-job-worker] Found ${count} jobs queued, invoking worker...`);

    // Invoke the worker using Supabase client
    const { data: workerData, error: workerError } = await supabase.functions.invoke(
      'alfie-job-worker',
      { body: { trigger: 'manual' } }
    );

    if (workerError) {
      console.error(`[trigger-job-worker] Worker failed:`, workerError);
      throw new Error(`Worker invocation failed: ${workerError.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Worker triggered successfully`,
        jobsQueued: count,
        workerResponse: workerData,
        watchdog: watchdogSummary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[trigger-job-worker] Error:", error);
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
