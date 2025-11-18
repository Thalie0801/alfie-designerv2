import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("[PURGE] Starting expired assets cleanup...");
    const now = new Date().toISOString();

    // 1. Récupérer tous les assets expirés
    const { data: expiredAssets, error: fetchError } = await supabaseClient
      .from("media_generations")
      .select("id, type, output_url, brand_id, expires_at, user_id")
      .lt("expires_at", now)
      .eq("status", "completed");

    if (fetchError) {
      console.error("[PURGE] Error fetching expired assets:", fetchError);
      throw fetchError;
    }

    if (!expiredAssets || expiredAssets.length === 0) {
      console.log("[PURGE] No expired assets to purge");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No expired assets to purge",
          purged: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`[PURGE] Found ${expiredAssets.length} expired assets`);

    // 2. Supprimer les assets du storage (si applicable)
    // Note: Pour l'instant on garde les URLs externes (Replicate), mais on peut ajouter
    // la suppression du bucket media-generations si on stocke localement

    // 3. Marquer les assets comme "expired" au lieu de les supprimer (audit trail)
    const { error: updateError } = await supabaseClient
      .from("media_generations")
      .update({ 
        status: "expired",
        updated_at: now
      })
      .lt("expires_at", now)
      .eq("status", "completed");

    if (updateError) {
      console.error("[PURGE] Error marking assets as expired:", updateError);
      throw updateError;
    }

    // 4. Log des assets purgés (conformité RGPD - logs sobres)
    const purgedByBrand = expiredAssets.reduce((acc: any, asset) => {
      const brandId = asset.brand_id || "unknown";
      if (!acc[brandId]) {
        acc[brandId] = { images: 0, videos: 0 };
      }
      if (asset.type === "video") {
        acc[brandId].videos++;
      } else {
        acc[brandId].images++;
      }
      return acc;
    }, {});

    console.log("[PURGE] Assets purged by brand:", purgedByBrand);
    console.log(`[PURGE] Successfully purged ${expiredAssets.length} expired assets`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Purged ${expiredAssets.length} expired assets`,
        purged: expiredAssets.length,
        byBrand: purgedByBrand
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[PURGE] Error in purge-expired-assets:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
