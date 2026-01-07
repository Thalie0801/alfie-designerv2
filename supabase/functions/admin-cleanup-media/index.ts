import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

/**
 * Admin function to clean up media_generations table
 * - Sets output_url to NULL for records > 7 days (frees up DB space)
 * - Deletes records > 30 days
 * - Works in batches to avoid timeouts
 * - Does NOT select output_url to avoid loading heavy base64 data
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log("[CLEANUP-MEDIA] Starting cleanup...");
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let totalNulled = 0;
    let totalDeleted = 0;

    // Step 1: NULL output_url for records > 7 days (batch processing)
    console.log("[CLEANUP-MEDIA] Step 1: Nullifying output_url for records > 7 days...");
    
    let batchCount = 0;
    while (true) {
      // Fetch batch of IDs only (NOT output_url to avoid heavy load)
      const { data: oldRecords, error: fetchError } = await supabaseClient
        .from("media_generations")
        .select("id")
        .lt("created_at", sevenDaysAgo)
        .not("output_url", "is", null)
        .limit(50);

      if (fetchError) {
        console.error("[CLEANUP-MEDIA] Error fetching old records:", fetchError);
        throw fetchError;
      }

      if (!oldRecords || oldRecords.length === 0) {
        console.log(`[CLEANUP-MEDIA] No more records to null (processed ${batchCount} batches)`);
        break;
      }

      batchCount++;
      console.log(`[CLEANUP-MEDIA] Batch ${batchCount}: Nullifying ${oldRecords.length} records...`);

      const { error: updateError } = await supabaseClient
        .from("media_generations")
        .update({ output_url: null, updated_at: now })
        .in("id", oldRecords.map(r => r.id));

      if (updateError) {
        console.error("[CLEANUP-MEDIA] Error nullifying output_url:", updateError);
        throw updateError;
      }

      totalNulled += oldRecords.length;

      // Small delay to avoid overwhelming DB
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 2: Delete records > 30 days (batch processing)
    console.log("[CLEANUP-MEDIA] Step 2: Deleting records > 30 days...");
    
    batchCount = 0;
    while (true) {
      // Fetch batch of IDs only
      const { data: veryOldRecords, error: fetchError } = await supabaseClient
        .from("media_generations")
        .select("id")
        .lt("created_at", thirtyDaysAgo)
        .limit(50);

      if (fetchError) {
        console.error("[CLEANUP-MEDIA] Error fetching very old records:", fetchError);
        throw fetchError;
      }

      if (!veryOldRecords || veryOldRecords.length === 0) {
        console.log(`[CLEANUP-MEDIA] No more records to delete (processed ${batchCount} batches)`);
        break;
      }

      batchCount++;
      console.log(`[CLEANUP-MEDIA] Batch ${batchCount}: Deleting ${veryOldRecords.length} records...`);

      const { error: deleteError } = await supabaseClient
        .from("media_generations")
        .delete()
        .in("id", veryOldRecords.map(r => r.id));

      if (deleteError) {
        console.error("[CLEANUP-MEDIA] Error deleting records:", deleteError);
        throw deleteError;
      }

      totalDeleted += veryOldRecords.length;

      // Small delay to avoid overwhelming DB
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[CLEANUP-MEDIA] Cleanup complete: ${totalNulled} nullified, ${totalDeleted} deleted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleanup complete: ${totalNulled} records had output_url nullified, ${totalDeleted} records deleted`,
        nullified: totalNulled,
        deleted: totalDeleted
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[CLEANUP-MEDIA] Error in admin-cleanup-media:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
