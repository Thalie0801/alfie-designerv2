import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_CONNECT_WEBHOOK_SECRET = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    // SECURITY: Verify Stripe webhook signature to prevent forged events
    if (!signature) {
      console.error("[Stripe Connect Webhook] Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!STRIPE_CONNECT_WEBHOOK_SECRET) {
      console.error("[Stripe Connect Webhook] STRIPE_CONNECT_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        STRIPE_CONNECT_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error("[Stripe Connect Webhook] Signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Stripe Connect Webhook] Verified event:", event.type);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Traiter l'événement account.updated
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const accountId = account.id;

      console.log("[Stripe Connect Webhook] Account updated:", accountId);

      // Récupérer l'affilié correspondant
      const { data: affiliate, error: fetchError } = await supabaseAdmin
        .from("affiliates")
        .select("id")
        .eq("stripe_connect_account_id", accountId)
        .maybeSingle();

      if (fetchError) {
        console.error("[Stripe Connect Webhook] Error fetching affiliate:", fetchError);
        throw fetchError;
      }

      if (!affiliate) {
        console.warn("[Stripe Connect Webhook] No affiliate found for account:", accountId);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mettre à jour le statut de l'affilié
      const updates = {
        stripe_connect_onboarding_complete: account.details_submitted || false,
        stripe_connect_charges_enabled: account.charges_enabled || false,
        stripe_connect_payouts_enabled: account.payouts_enabled || false,
      };

      const { error: updateError } = await supabaseAdmin
        .from("affiliates")
        .update(updates)
        .eq("id", affiliate.id);

      if (updateError) {
        console.error("[Stripe Connect Webhook] Error updating affiliate:", updateError);
        throw updateError;
      }

      console.log("[Stripe Connect Webhook] Affiliate updated successfully:", affiliate.id, updates);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Stripe Connect Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
