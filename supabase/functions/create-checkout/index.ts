import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireEnv } from "../_shared/env.ts";
import { CheckoutSchema, validateInput } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_IDS = {
  monthly: {
    starter: "price_1SGDCEQvcbGhgt8SB4SyubJd",
    pro: "price_1SGDDFQvcbGhgt8Sxc5AD69b",
    studio: "price_1SGDLmQvcbGhgt8SKWpBTjCg",
    enterprise: "price_ENTERPRISE_MONTHLY",
  },
  annual: {
    starter: "price_1SGDPHQvcbGhgt8SUJSVCBmg",
    pro: "price_1SGDPWQvcbGhgt8SZglD8b5d",
    studio: "price_1SGDPkQvcbGhgt8SttOl1idn",
    enterprise: "price_ENTERPRISE_ANNUAL",
  }
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

// Fonction pour extraire l'utilisateur du JWT
async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY");
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    // Récupérer l'utilisateur depuis le JWT
    const user = await getUserFromRequest(req);
    if (!user?.email) {
      console.error("[create-checkout] No authenticated user found");
      return jsonResponse({ ok: false, error: "Authentification requise" }, 401);
    }

    const body = await req.json();

    const validation = validateInput(CheckoutSchema, body);
    if (!validation.success) {
      return jsonResponse({ ok: false, error: validation.error }, 400);
    }

    const { plan, billing_period, brand_name, affiliate_ref } = validation.data;

    console.log("[create-checkout] Creating checkout for authenticated user", { 
      email: user.email, 
      userId: user.id,
      plan, 
      billing_period 
    });

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      console.error("[create-checkout] STRIPE_SECRET_KEY missing");
      return jsonResponse({ ok: false, error: "STRIPE_SECRET_KEY missing" }, 500);
    }

    const billingType = billing_period === "annual" ? "annual" : "monthly";
    const planType = plan as keyof typeof PRICE_IDS["monthly"];
    const priceId = PRICE_IDS[billingType][planType];

    if (!priceId) {
      console.error("[create-checkout] Invalid plan or billing period", { plan, billing_period });
      return jsonResponse({ ok: false, error: "Invalid plan selection" }, 400);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-08-27.basil",
    });

    const frontendUrl =
      Deno.env.get("FRONTEND_URL") ||
      Deno.env.get("SITE_URL") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        billing_period,
        brand_name: brand_name || "",
        affiliate_ref: affiliate_ref || "",
        supabase_user_id: user.id,
        source: "billing-page",
      },
      allow_promotion_codes: true,
      success_url: `${frontendUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing?payment=cancelled`,
    });

    return jsonResponse({ ok: true, url: session.url });
  } catch (error: any) {
    console.error("[create-checkout] Error", error);
    return jsonResponse({ ok: false, error: error.message ?? "Unknown error" }, 500);
  }
});
