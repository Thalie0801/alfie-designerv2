import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("[STRIPE-RENEWAL] No signature provided");
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[STRIPE-RENEWAL] Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[STRIPE-RENEWAL] Received event: ${event.type}`);

    // Gérer le renouvellement d'abonnement (paiement récurrent réussi)
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      
      // Ignorer les premiers paiements (création d'abonnement) - uniquement les renouvellements
      if (invoice.billing_reason !== "subscription_cycle") {
        console.log(`[STRIPE-RENEWAL] Skipping non-renewal invoice (reason: ${invoice.billing_reason})`);
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerId = invoice.customer as string;
      const subscriptionId = invoice.subscription as string;
      
      console.log(`[STRIPE-RENEWAL] Processing renewal for customer: ${customerId}`);

      // Trouver le profil utilisateur via stripe_customer_id
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("id, email, plan")
        .eq("stripe_customer_id", customerId)
        .single();

      if (profileError || !profile) {
        console.error("[STRIPE-RENEWAL] Profile not found for customer:", customerId, profileError);
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[STRIPE-RENEWAL] Found profile: ${profile.id} (${profile.email}), plan: ${profile.plan}`);

      // Récupérer la subscription pour obtenir la prochaine date de renouvellement
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const nextRenewalDate = new Date(subscription.current_period_end * 1000);
      const nextRenewalDateStr = nextRenewalDate.toISOString().split('T')[0];

      console.log(`[STRIPE-RENEWAL] Next renewal date: ${nextRenewalDateStr}`);

      // Trouver les brands de cet utilisateur
      const { data: brands, error: brandsError } = await supabaseClient
        .from("brands")
        .select("id, name, woofs_used, images_used, videos_used")
        .eq("user_id", profile.id);

      if (brandsError) {
        console.error("[STRIPE-RENEWAL] Error fetching brands:", brandsError);
        throw brandsError;
      }

      if (!brands || brands.length === 0) {
        console.log("[STRIPE-RENEWAL] No brands found for user, nothing to reset");
        return new Response(JSON.stringify({ success: true, reset: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const brandIds = brands.map(b => b.id);
      console.log(`[STRIPE-RENEWAL] Resetting ${brands.length} brand(s): ${brandIds.join(", ")}`);

      // Reset des compteurs sur les brands
      const { error: updateBrandsError } = await supabaseClient
        .from("brands")
        .update({
          woofs_used: 0,
          images_used: 0,
          videos_used: 0,
          resets_on: nextRenewalDateStr,
          updated_at: new Date().toISOString(),
        })
        .in("id", brandIds);

      if (updateBrandsError) {
        console.error("[STRIPE-RENEWAL] Error updating brands:", updateBrandsError);
        throw updateBrandsError;
      }

      // Reset dans counters_monthly pour le mois courant
      const now = new Date();
      const currentPeriod = now.getFullYear() * 100 + (now.getMonth() + 1); // Format YYYYMM

      for (const brandId of brandIds) {
        // Upsert pour s'assurer que la ligne existe
        const { error: counterError } = await supabaseClient
          .from("counters_monthly")
          .upsert({
            brand_id: brandId,
            period_yyyymm: currentPeriod,
            woofs_used: 0,
            images_used: 0,
            reels_used: 0,
          }, {
            onConflict: "brand_id,period_yyyymm"
          });

        if (counterError) {
          console.error(`[STRIPE-RENEWAL] Error resetting counters for brand ${brandId}:`, counterError);
        }
      }

      // Log les stats avant reset pour audit
      const totalWoofsReset = brands.reduce((sum, b) => sum + (b.woofs_used || 0), 0);
      const totalImagesReset = brands.reduce((sum, b) => sum + (b.images_used || 0), 0);
      const totalVideosReset = brands.reduce((sum, b) => sum + (b.videos_used || 0), 0);

      console.log(`[STRIPE-RENEWAL] Successfully reset quotas for user ${profile.email}:`);
      console.log(`  - Brands reset: ${brands.length}`);
      console.log(`  - Woofs reset: ${totalWoofsReset}`);
      console.log(`  - Images reset: ${totalImagesReset}`);
      console.log(`  - Videos reset: ${totalVideosReset}`);
      console.log(`  - Next renewal: ${nextRenewalDateStr}`);

      return new Response(
        JSON.stringify({
          success: true,
          userId: profile.id,
          email: profile.email,
          brandsReset: brands.length,
          nextRenewalDate: nextRenewalDateStr,
          stats: {
            woofsReset: totalWoofsReset,
            imagesReset: totalImagesReset,
            videosReset: totalVideosReset,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Autres événements non traités
    console.log(`[STRIPE-RENEWAL] Unhandled event type: ${event.type}`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[STRIPE-RENEWAL] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
