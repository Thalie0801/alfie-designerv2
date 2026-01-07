import { createClient } from "npm:@supabase/supabase-js@2";
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

    const { data: affiliate, error: affiliateError } = await supabaseClient
      .from("affiliates")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .single();

    if (affiliateError || !affiliate || !affiliate.stripe_connect_account_id) {
      return new Response(JSON.stringify({ error: "No Stripe Connect account found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Générer un nouveau Account Link
    const accountLinkResponse = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: affiliate.stripe_connect_account_id,
        refresh_url: `${req.headers.get("origin") || "https://alfie-designer.lovable.app"}/affiliate?refresh=true`,
        return_url: `${req.headers.get("origin") || "https://alfie-designer.lovable.app"}/affiliate?success=true`,
        type: "account_onboarding",
      }),
    });

    const accountLink = await accountLinkResponse.json();
    
    if (!accountLinkResponse.ok) {
      console.error("[Stripe Connect Refresh] Error:", accountLink);
      throw new Error(accountLink.error?.message || "Failed to create onboarding link");
    }

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Stripe Connect Refresh] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
