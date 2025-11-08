import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, INTERNAL_FN_SECRET } from "../_shared/env.ts";

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
          jobsQueued: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[trigger-job-worker] Found ${count} jobs queued, invoking worker...`);

    // Invoke the worker
    const workerResp = await fetch(`${SUPABASE_URL}/functions/v1/alfie-job-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "X-Internal-Secret": INTERNAL_FN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "manual" }),
    });

    const workerText = await workerResp.text().catch(() => "");

    if (!workerResp.ok) {
      console.error(`[trigger-job-worker] Worker failed: ${workerResp.status} ${workerText}`);
      throw new Error(`Worker invocation failed: ${workerResp.status}`);
    }

    let workerData;
    try {
      workerData = JSON.parse(workerText);
    } catch {
      workerData = { raw: workerText };
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Worker triggered successfully`,
        jobsQueued: count,
        workerResponse: workerData,
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
