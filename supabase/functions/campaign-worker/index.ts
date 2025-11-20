import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Campaign Worker
 * Processes pending assets in campaigns
 * Can be triggered manually or via cron job
 */

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[campaign-worker] Starting worker...");

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all pending assets from running campaigns
    const { data: pendingAssets, error: fetchError } = await supabase
      .from("assets")
      .select("*, campaigns!inner(status, user_id)")
      .eq("status", "pending")
      .eq("campaigns.status", "running")
      .limit(10); // Process max 10 at a time

    if (fetchError) {
      console.error("[campaign-worker] Error fetching assets:", fetchError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "fetch_failed",
          message: fetchError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!pendingAssets || pendingAssets.length === 0) {
      console.log("[campaign-worker] No pending assets to process");
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No pending assets",
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[campaign-worker] Found ${pendingAssets.length} pending assets`);

    const results = [];

    // Process each asset
    for (const asset of pendingAssets) {
      try {
        console.log(`[campaign-worker] Processing asset ${asset.id} (type: ${asset.type})`);

        // Route to appropriate generation function based on type
        let functionName = "";
        
        switch (asset.type) {
          case "image":
            functionName = "campaign-generate-image";
            break;
          case "carousel":
            functionName = "campaign-generate-carousel";
            break;
          case "video":
            // Video generation not implemented yet
            console.log(`[campaign-worker] Skipping video asset ${asset.id} (not implemented)`);
            continue;
          default:
            console.warn(`[campaign-worker] Unknown asset type: ${asset.type}`);
            continue;
        }

        // Call the generation function
        // Note: We need to create a service role token for the user
        const { data: { session }, error: sessionError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: 'system@alfiedesigner.com', // System user
        });

        // For now, we'll use service role key directly
        const response = await fetch(
          `${supabaseUrl}/functions/v1/${functionName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              asset_id: asset.id,
            }),
          }
        );

        const result = await response.json();

        if (response.ok && result.ok) {
          console.log(`[campaign-worker] Successfully processed asset ${asset.id}`);
          results.push({
            asset_id: asset.id,
            status: "success",
          });
        } else {
          console.error(`[campaign-worker] Failed to process asset ${asset.id}:`, result);
          results.push({
            asset_id: asset.id,
            status: "failed",
            error: result.error || result.message,
          });
        }

        // Small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[campaign-worker] Error processing asset ${asset.id}:`, error);
        results.push({
          asset_id: asset.id,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("[campaign-worker] Worker completed");

    return new Response(
      JSON.stringify({
        ok: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[campaign-worker] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
