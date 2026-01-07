import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

/**
 * Ce cron ne reset plus les quotas au 1er du mois.
 * Le reset des Woofs se fait désormais via le webhook Stripe (stripe-subscription-renewal)
 * au moment du renouvellement de l'abonnement.
 * 
 * Ce cron ne garde qu'un rôle de fallback pour:
 * - Les utilisateurs sans abonnement Stripe actif (trial, freemium)
 * - Les comptes "granted_by_admin"
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
    console.log("[RESET-FALLBACK] Checking for brands needing fallback reset...");
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Calculer la prochaine date de reset (1er du mois suivant)
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextResetDate = nextReset.toISOString().split('T')[0];

    // Uniquement les brands:
    // 1. Dont resets_on est passé OU null
    // 2. ET dont le user n'a PAS d'abonnement Stripe actif (stripe_subscription_id null sur profile)
    const { data: brands, error: fetchError } = await supabaseClient
      .from("brands")
      .select(`
        id, 
        name, 
        plan, 
        images_used, 
        videos_used, 
        woofs_used,
        user_id,
        resets_on
      `)
      .or(`resets_on.lte.${todayStr},resets_on.is.null`);

    if (fetchError) {
      console.error("[RESET-FALLBACK] Error fetching brands:", fetchError);
      throw fetchError;
    }

    if (!brands || brands.length === 0) {
      console.log("[RESET-FALLBACK] No brands to check");
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

    // Récupérer les profils pour vérifier s'ils ont un abonnement Stripe
    const userIds = [...new Set(brands.map(b => b.user_id))];
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, stripe_subscription_id, granted_by_admin")
      .in("id", userIds);

    if (profilesError) {
      console.error("[RESET-FALLBACK] Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Map des profiles
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Filtrer: uniquement les brands dont le user n'a PAS d'abonnement Stripe
    // OU qui sont granted_by_admin (comptes offerts)
    const brandsToReset = brands.filter(brand => {
      const profile = profileMap.get(brand.user_id);
      if (!profile) return false;
      
      // Reset si pas d'abonnement Stripe OU si granted_by_admin
      return !profile.stripe_subscription_id || profile.granted_by_admin;
    });

    if (brandsToReset.length === 0) {
      console.log("[RESET-FALLBACK] All brands have Stripe subscriptions, nothing to reset (handled by webhook)");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All brands managed by Stripe webhook",
          reset: 0,
          totalChecked: brands.length
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const brandIdsToReset = brandsToReset.map(b => b.id);
    console.log(`[RESET-FALLBACK] Resetting ${brandsToReset.length} brands without Stripe subscription`);

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
      .in("id", brandIdsToReset);

    if (updateError) {
      console.error("[RESET-FALLBACK] Error resetting quotas:", updateError);
      throw updateError;
    }

    // Log des resets
    const resetStats = brandsToReset.reduce((acc: any, brand) => {
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

    console.log("[RESET-FALLBACK] Reset stats by plan:", resetStats);
    console.log(`[RESET-FALLBACK] Successfully reset ${brandsToReset.length} brands (fallback mode)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset quotas for ${brandsToReset.length} brands (fallback)`,
        reset: brandsToReset.length,
        totalChecked: brands.length,
        nextResetDate,
        statsByPlan: resetStats
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[RESET-FALLBACK] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
