import Stripe from "https://esm.sh/stripe@18.5.0";
import { CheckoutSchema, validateInput } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: restrict to frontend domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_IDS = {
  monthly: {
    starter: "price_1SGDCEQvcbGhgt8SB4SyubJd",    // 39€/mois
    pro: "price_1SGDDFQvcbGhgt8Sxc5AD69b",        // 99€/mois
    studio: "price_1SGDLmQvcbGhgt8SKWpBTjCg",     // 199€/mois
  },
  annual: {
    starter: "price_1SGDPHQvcbGhgt8SUJSVCBmg",    // 374.40€/an (-20%)
    pro: "price_1SGDPWQvcbGhgt8SZglD8b5d",        // 950.40€/an (-20%)
    studio: "price_1SGDPkQvcbGhgt8SttOl1idn",     // 1910.40€/an (-20%)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();

    const validation = validateInput(CheckoutSchema, body);
    if (!validation.success) {
      return jsonResponse({ ok: false, error: validation.error }, 400);
    }

    const { plan, billing_period, email, brand_name, affiliate_ref } = validation.data;

    console.log("[create-checkout] Incoming request", { plan, billing_period, email });

    if (!email) {
      console.error("[create-checkout] Email missing from request");
      return jsonResponse({ ok: false, error: "Email requis pour le checkout" }, 400);
    }

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
      apiVersion: "2024-11-20",
    });

    const frontendUrl =
      Deno.env.get("FRONTEND_URL") ||
      Deno.env.get("SITE_URL") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
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
      },
      success_url: `${frontendUrl}/auth?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?payment=canceled`,
    });

    return jsonResponse({ ok: true, url: session.url });
  } catch (error: any) {
    console.error("[create-checkout] Error", error);
    return jsonResponse({ ok: false, error: error.message ?? "Unknown error" }, 500);
  }
});
