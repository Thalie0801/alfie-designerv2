import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("[RESET] Starting monthly quota reset...");
    const now = new Date();
    const currentDay = now.getDate();

    // Vérifier si on est le 1er du mois
    if (currentDay !== 1) {
      console.log(`[RESET] Not reset day (current day: ${currentDay})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Not reset day, skipping",
          currentDay 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Calculer la prochaine date de reset (1er du mois suivant)
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextResetDate = nextReset.toISOString().split('T')[0];

    // Reset des compteurs pour toutes les marques
    const { data: brands, error: fetchError } = await supabaseClient
      .from("brands")
      .select("id, name, plan, images_used, videos_used, woofs_used")
      .lte("resets_on", now.toISOString().split('T')[0]);

    if (fetchError) {
      console.error("[RESET] Error fetching brands:", fetchError);
      throw fetchError;
    }

    if (!brands || brands.length === 0) {
      console.log("[RESET] No brands to reset");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No brands to reset",
          reset: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`[RESET] Resetting quotas for ${brands.length} brands`);

    // Reset des compteurs
    const { error: updateError } = await supabaseClient
      .from("brands")
      .update({ 
        images_used: 0,
        videos_used: 0,
        woofs_used: 0,
        resets_on: nextResetDate,
        updated_at: now.toISOString()
      })
      .lte("resets_on", now.toISOString().split('T')[0]);

    if (updateError) {
      console.error("[RESET] Error resetting quotas:", updateError);
      throw updateError;
    }

    // Log des resets (conformité - logs sobres)
    const resetStats = brands.reduce((acc: any, brand) => {
      const plan = brand.plan || "unknown";
      if (!acc[plan]) {
        acc[plan] = { count: 0, totalImages: 0, totalVideos: 0, totalWoofs: 0 };
      }
      acc[plan].count++;
      acc[plan].totalImages += brand.images_used || 0;
      acc[plan].totalVideos += brand.videos_used || 0;
      acc[plan].totalWoofs += brand.woofs_used || 0;
      return acc;
    }, {});

    console.log("[RESET] Reset stats by plan:", resetStats);
    console.log(`[RESET] Successfully reset ${brands.length} brands`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset quotas for ${brands.length} brands`,
        reset: brands.length,
        nextResetDate,
        statsByPlan: resetStats
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[RESET] Error in reset-monthly-quotas:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
