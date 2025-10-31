import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { CheckoutSchema, validateInput } from "../_shared/validation.ts";

const ALLOWED_ORIGINS = [
  'https://alfie-designer.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || '') ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

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

// Plan configuration (quotas are applied in verify-payment after successful payment)

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const validation = validateInput(CheckoutSchema, body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    const { plan, billing_period, affiliate_ref, brand_name } = validation.data;
    
    const billingType = billing_period === 'annual' ? 'annual' : 'monthly';
    const planType = plan as 'starter' | 'pro' | 'studio';
    
    if (!planType || !PRICE_IDS[billingType][planType]) {
      throw new Error("Invalid plan selected");
    }

    const priceId = PRICE_IDS[billingType][planType];
    
    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    let userEmail: string | undefined;
    let userId: string | undefined;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      userEmail = data.user?.email;
      userId = data.user?.id;
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
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=canceled`,
      metadata: {
        plan,
        user_id: userId || "",
        affiliate_ref: affiliate_ref || "",
        brand_name: brand_name || "",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in create-checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
