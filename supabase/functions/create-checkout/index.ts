import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { CheckoutSchema, validateInput } from "../_shared/validation.ts";

import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_ORIGINS = [
  "https://alfie-designer.com",
  "https://alfie-designer.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("origin");
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
  };
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

const jsonResponse = (req: Request, payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });

// Plan configuration (quotas are applied in verify-payment after successful payment)

Deno.serve(async (req) => {
  const requestCorsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: requestCorsHeaders });
  }

  console.log("[create-checkout] function invoked");

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const validation = validateInput(CheckoutSchema, body);
    if (!validation.success) {
      return jsonResponse(req, { error: validation.error }, 400);
    }
    
    const { plan, billing_period, affiliate_ref, brand_name, email } = validation.data;
    
    const billingType = billing_period === 'annual' ? 'annual' : 'monthly';
    const planType = plan as 'starter' | 'pro' | 'studio';
    
    if (!planType || !PRICE_IDS[billingType][planType]) {
      throw new Error("Invalid plan selected");
    }

    const priceId = PRICE_IDS[billingType][planType];
    
    // Check if user is authenticated (optional)
    const authHeader = req.headers.get("Authorization");
    let userEmail: string | undefined;
    let userId: string | undefined;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      userEmail = data.user?.email;
      userId = data.user?.id;
    } else {
      // Guest checkout: use email from request body
      userEmail = email;
    }
    
    if (!userEmail) {
      throw new Error("Email is required for checkout");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    let customerId;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
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
        user_id: userId || "",
        email: userEmail,
        affiliate_ref: affiliate_ref || "",
        brand_name: brand_name || "",
      },
    });

    return jsonResponse(req, { url: session.url });
  } catch (error: any) {
    console.error("Error in create-checkout:", error);
    return jsonResponse(req, { error: error.message }, 500);
  }
});
