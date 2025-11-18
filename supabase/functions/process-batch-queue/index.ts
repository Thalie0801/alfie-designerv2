import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Query batch requests ready to process
    const { data: requests, error: queryError } = await supabase
      .from("batch_requests")
      .select("*")
      .lte("process_after", new Date().toISOString())
      .eq("status", "queued")
      .limit(50);

    if (queryError) throw queryError;

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No requests to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;

    for (const request of requests) {
      try {
        // Update status to running
        await supabase
          .from("batch_requests")
          .update({ status: "running" })
          .eq("id", request.id);

        const { modality, payload_json, user_id } = request;
        const { prompt, format, duration, quality, provider } = payload_json;

        // Full pipeline: select → check → consume → render → score → update_metrics
        // Simplified for Phase 2 stub
        console.log("[Batch Process]", { user_id, modality, prompt });

        // TODO: Implement full pipeline
        // For now, mark as done
        await supabase
          .from("batch_requests")
          .update({
            status: "done",
            result_json: { message: "Processed (stub)" }
          })
          .eq("id", request.id);

        processedCount++;
      } catch (error: any) {
        console.error(`Error processing request ${request.id}:`, error);
        
        await supabase
          .from("batch_requests")
          .update({
            status: "failed",
            result_json: { error: error.message }
          })
          .eq("id", request.id);
      }
    }

    return new Response(
      JSON.stringify({ processed: processedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
