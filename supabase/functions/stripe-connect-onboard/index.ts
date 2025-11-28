import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

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

    // Vérifier que l'utilisateur est un affilié
    const { data: affiliate, error: affiliateError } = await supabaseClient
      .from("affiliates")
      .select("*")
      .eq("id", user.id)
      .single();

    if (affiliateError || !affiliate) {
      return new Response(JSON.stringify({ error: "Not an affiliate" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accountId = affiliate.stripe_connect_account_id;

    // Si pas encore de compte Stripe Connect, le créer
    if (!accountId) {
      console.log("[Stripe Connect Onboard] Creating new Express account for affiliate:", user.id);
      
      const createAccountResponse = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          type: "express",
          country: "FR",
          email: affiliate.email,
          "capabilities[transfers][requested]": "true",
          business_type: "individual",
        }),
      });

      const account = await createAccountResponse.json();
      
      if (!createAccountResponse.ok) {
        console.error("[Stripe Connect Onboard] Error creating account:", account);
        throw new Error(account.error?.message || "Failed to create Stripe account");
      }

      accountId = account.id;

      // Sauvegarder l'account_id dans la BDD
      const { error: updateError } = await supabaseClient
        .from("affiliates")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);

      if (updateError) {
        console.error("[Stripe Connect Onboard] Failed to save account_id:", updateError);
        throw new Error("Failed to save Stripe account ID");
      }

      console.log("[Stripe Connect Onboard] Account created and saved:", accountId);
    }

    // Générer l'Account Link pour l'onboarding
    const accountLinkResponse = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${req.headers.get("origin") || "https://alfie-designer.lovable.app"}/affiliate?refresh=true`,
        return_url: `${req.headers.get("origin") || "https://alfie-designer.lovable.app"}/affiliate?success=true`,
        type: "account_onboarding",
      }),
    });

    const accountLink = await accountLinkResponse.json();
    
    if (!accountLinkResponse.ok) {
      console.error("[Stripe Connect Onboard] Error creating account link:", accountLink);
      throw new Error(accountLink.error?.message || "Failed to create onboarding link");
    }

    console.log("[Stripe Connect Onboard] Onboarding URL generated for:", accountId);

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Stripe Connect Onboard] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
