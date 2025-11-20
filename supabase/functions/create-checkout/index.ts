import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { CheckoutSchema, validateInput } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

// Plan configuration (quotas are applied in verify-payment after successful payment)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[create-checkout] function invoked");

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const validation = validateInput(CheckoutSchema, body);
    if (!validation.success) {
      return jsonResponse({ error: validation.error }, 400);
    }
    
    const { plan, billing_period, affiliate_ref, brand_name, email, coupon_code } = validation.data;
    
    const billingType = billing_period === 'annual' ? 'annual' : 'monthly';
    const planType = plan as 'starter' | 'pro' | 'studio';
    
    if (!planType || !PRICE_IDS[billingType][planType]) {
      throw new Error("Invalid plan selected");
    }

    const priceId = PRICE_IDS[billingType][planType];
    
    // Email is required (provided by frontend for both auth and guest users)
    if (!email) {
      throw new Error("Email is required for checkout");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    let customerId;
    if (email) {
      const customers = await stripe.customers.list({ email: email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    // Build session options
    const sessionOptions: any = {
      customer: customerId,
      customer_email: customerId ? undefined : email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/auth?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=canceled`,
      metadata: {
        plan,
        user_id: "",  // Will be set in verify-payment
        email: email,
        affiliate_ref: affiliate_ref || "",
        brand_name: brand_name || "",
      },
    };

    // Add coupon if provided
    if (coupon_code && coupon_code.trim() !== '') {
      sessionOptions.discounts = [{
        coupon: coupon_code.trim().toUpperCase(),
      }];
    }
    
    const session = await stripe.checkout.sessions.create(sessionOptions);

    return jsonResponse({ url: session.url });
  } catch (error: any) {
    console.error("Error in create-checkout:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
