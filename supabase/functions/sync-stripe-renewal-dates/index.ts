import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Récupérer tous les profils avec un stripe_subscription_id actif
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, stripe_subscription_id, stripe_customer_id")
      .not("stripe_subscription_id", "is", null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`📊 Found ${profiles?.length ?? 0} profiles with Stripe subscriptions`);

    const results: Array<{
      email: string;
      subscriptionId: string;
      oldResetOn: string | null;
      newResetOn: string;
      status: string;
    }> = [];

    for (const profile of profiles ?? []) {
      try {
        // Récupérer les détails de l'abonnement depuis Stripe
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

        if (subscription.status !== "active" && subscription.status !== "trialing") {
          console.log(`⚠️ Subscription ${profile.stripe_subscription_id} is ${subscription.status}, skipping`);
          continue;
        }

        // Calculer la date de renouvellement (current_period_end)
        const renewalDate = new Date(subscription.current_period_end * 1000).toISOString();

        // Récupérer les brands de cet utilisateur
        const { data: brands, error: brandsError } = await supabase
          .from("brands")
          .select("id, resets_on")
          .eq("user_id", profile.id);

        if (brandsError) {
          console.error(`❌ Failed to fetch brands for ${profile.email}: ${brandsError.message}`);
          continue;
        }

        // Mettre à jour chaque brand avec la vraie date de renouvellement
        for (const brand of brands ?? []) {
          const { error: updateError } = await supabase
            .from("brands")
            .update({
              resets_on: renewalDate,
              updated_at: new Date().toISOString(),
            })
            .eq("id", brand.id);

          if (updateError) {
            console.error(`❌ Failed to update brand ${brand.id}: ${updateError.message}`);
          } else {
            console.log(`✅ Updated brand ${brand.id} for ${profile.email}: resets_on = ${renewalDate}`);
            results.push({
              email: profile.email,
              subscriptionId: profile.stripe_subscription_id,
              oldResetOn: brand.resets_on,
              newResetOn: renewalDate,
              status: "updated",
            });
          }
        }
      } catch (stripeError: unknown) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError);
        console.error(`❌ Stripe error for ${profile.email}: ${errorMessage}`);
        results.push({
          email: profile.email,
          subscriptionId: profile.stripe_subscription_id,
          oldResetOn: null,
          newResetOn: "",
          status: `error: ${errorMessage}`,
        });
      }
    }

    console.log(`🎉 Sync completed: ${results.filter((r) => r.status === "updated").length} brands updated`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronized ${results.filter((r) => r.status === "updated").length} brands with Stripe renewal dates`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
