import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { assertIsAdmin } from "../_shared/utils/admin.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier que l'utilisateur est admin
    const isAdmin = await assertIsAdmin(supabaseClient, user.id);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payoutId } = await req.json();

    if (!payoutId) {
      return new Response(JSON.stringify({ error: "Missing payoutId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Récupérer le payout
    const { data: payout, error: payoutError } = await supabaseClient
      .from("affiliate_payouts")
      .select("*, affiliates!inner(stripe_connect_account_id, stripe_connect_payouts_enabled, email)")
      .eq("id", payoutId)
      .eq("status", "pending")
      .single();

    if (payoutError || !payout) {
      return new Response(JSON.stringify({ error: "Payout not found or not pending" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const affiliate = payout.affiliates;

    // Vérifier que l'affilié a un compte Stripe Connect configuré
    if (!affiliate.stripe_connect_account_id) {
      return new Response(
        JSON.stringify({ error: "Affiliate has no Stripe Connect account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!affiliate.stripe_connect_payouts_enabled) {
      return new Response(
        JSON.stringify({ error: "Affiliate payouts not enabled on Stripe account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier que l'affilié a un abonnement actif
    const { data: affiliateProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("plan, stripe_subscription_id")
      .eq("id", payout.affiliate_id)
      .single();

    if (profileError || !affiliateProfile) {
      return new Response(
        JSON.stringify({ error: "Affiliate profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bloquer le paiement si pas d'abonnement actif
    if (!affiliateProfile.plan || affiliateProfile.plan === 'none' || !affiliateProfile.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "Affiliate has no active subscription - payout blocked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Admin Process Payout] Creating transfer for:", {
      payoutId,
      affiliateId: payout.affiliate_id,
      amount: payout.amount,
      stripeAccount: affiliate.stripe_connect_account_id,
    });

    // Créer un Transfer Stripe vers le compte Connect
    const amountCents = Math.round(payout.amount * 100);

    const transferResponse = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: amountCents.toString(),
        currency: "eur",
        destination: affiliate.stripe_connect_account_id,
        description: `Commission payout - Period ${payout.period}`,
      }),
    });

    const transfer = await transferResponse.json();

    if (!transferResponse.ok) {
      console.error("[Admin Process Payout] Stripe transfer error:", transfer);
      throw new Error(transfer.error?.message || "Failed to create transfer");
    }

    console.log("[Admin Process Payout] Transfer created:", transfer.id);

    // Mettre à jour le payout en BDD
    const { error: updateError } = await supabaseClient
      .from("affiliate_payouts")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", payoutId);

    if (updateError) {
      console.error("[Admin Process Payout] Error updating payout:", updateError);
      throw updateError;
    }

    console.log("[Admin Process Payout] Payout marked as paid:", payoutId);

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        amount: payout.amount,
        affiliate_email: affiliate.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Admin Process Payout] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
