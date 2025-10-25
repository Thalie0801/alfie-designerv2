import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan quotas configuration
const PLAN_QUOTAS = {
  starter: {
    quota_visuals_per_month: 150,
    quota_videos: 15,
    quota_brands: 1,
  },
  pro: {
    quota_visuals_per_month: 450,
    quota_videos: 45,
    quota_brands: 1,
  },
  studio: {
    quota_visuals_per_month: 1000,
    quota_videos: 100,
    quota_brands: 1,
  },
  enterprise: {
    quota_visuals_per_month: 9999,
    quota_videos: 9999,
    quota_brands: 999,
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all users with plans
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, plan, quota_visuals_per_month, quota_videos, quota_brands, generations_this_month")
      .not("plan", "is", null)
      .neq("plan", "none");

    if (fetchError) throw fetchError;

    let fixedCount = 0;
    const results: any[] = [];

    for (const profile of profiles || []) {
      const plan = profile.plan as keyof typeof PLAN_QUOTAS;
      const quotas = PLAN_QUOTAS[plan];

      if (!quotas) {
        console.log(`Unknown plan for ${profile.email}: ${plan}`);
        continue;
      }

      // Check if quotas need fixing
      const needsFixing =
        profile.quota_visuals_per_month !== quotas.quota_visuals_per_month ||
        profile.quota_videos !== quotas.quota_videos ||
        profile.quota_brands !== quotas.quota_brands ||
        profile.quota_visuals_per_month === 0;

      if (needsFixing) {
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            quota_visuals_per_month: quotas.quota_visuals_per_month,
            quota_videos: quotas.quota_videos,
            quota_brands: quotas.quota_brands,
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error(`Failed to fix ${profile.email}:`, updateError);
          results.push({
            email: profile.email,
            plan,
            status: "error",
            error: updateError.message,
          });
        } else {
          fixedCount++;
          results.push({
            email: profile.email,
            plan,
            status: "fixed",
            before: {
              visuals: profile.quota_visuals_per_month,
              videos: profile.quota_videos,
              brands: profile.quota_brands,
            },
            after: quotas,
          });
          console.log(`✅ Fixed ${profile.email} (${plan})`);
        }
      } else {
        results.push({
          email: profile.email,
          plan,
          status: "ok",
        });
      }
    }

    // Now fix brands quotas to match their user's plan
    const { data: brands, error: brandsError } = await supabaseAdmin
      .from("brands")
      .select("id, user_id, quota_images, quota_videos, quota_woofs");

    if (brandsError) throw brandsError;

    let brandFixedCount = 0;

    for (const brand of brands || []) {
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("plan")
        .eq("id", brand.user_id)
        .single();

      if (!userProfile?.plan) continue;

      const plan = userProfile.plan as keyof typeof PLAN_QUOTAS;
      const quotas = PLAN_QUOTAS[plan];

      if (!quotas) continue;

      const needsFixing =
        brand.quota_images !== quotas.quota_visuals_per_month ||
        brand.quota_videos !== quotas.quota_videos;

      if (needsFixing) {
        const { error: updateError } = await supabaseAdmin
          .from("brands")
          .update({
            quota_images: quotas.quota_visuals_per_month,
            quota_videos: quotas.quota_videos,
            quota_woofs: quotas.quota_videos, // Woofs = video quota
          })
          .eq("id", brand.id);

        if (!updateError) {
          brandFixedCount++;
          console.log(`✅ Fixed brand ${brand.id} for plan ${plan}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profiles_fixed: fixedCount,
        brands_fixed: brandFixedCount,
        total_profiles: profiles?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Fix quotas error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
