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

    const countQueued = async () => {
      const { count } = await supabase
        .from("job_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "queued");
      return count ?? 0;
    };

    const queuedBefore = await countQueued();

    if (queuedBefore === 0) {
      return new Response(
        JSON.stringify({
          processed: 0,
          queuedBefore,
          queuedAfter: queuedBefore,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[trigger-job-worker] Found ${queuedBefore} jobs queued, invoking worker...`);

    // Invoke the worker using Supabase client
    const { data: workerData, error: workerError } = await supabase.functions.invoke(
      "alfie-job-worker",
      { body: { trigger: "manual" } },
    );

    if (workerError) {
      console.error(`[trigger-job-worker] Worker failed:`, workerError);
      throw new Error(`Worker invocation failed: ${workerError.message}`);
    }

    const queuedAfter = await countQueued();

    const extractProcessed = (input: any): number | null => {
      if (input == null) return null;
      if (typeof input === "number") return input;
      if (typeof input === "object") {
        if (typeof input.processed === "number") return input.processed;
        if ("data" in input) return extractProcessed((input as any).data);
      }
      return null;
    };

    const workerProcessed = extractProcessed(workerData);
    const processed = workerProcessed ?? Math.max(queuedBefore - queuedAfter, 0);

    if (processed === 0 && queuedBefore > 0) {
      console.warn(
        `[trigger-job-worker] ⚠️ processed=0 with queuedBefore=${queuedBefore}, queuedAfter=${queuedAfter}`,
        { workerData },
      );
    }

    return new Response(
      JSON.stringify({
        processed,
        queuedBefore,
        queuedAfter,
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
