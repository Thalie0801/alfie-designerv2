import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prix pour les abonnements
const SUBSCRIPTION_PRICE_IDS = {
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
    
    // Déterminer le mode: subscription (défaut) ou payment (one-off)
    const mode = body.mode === 'payment' ? 'payment' : 'subscription';
    
    console.log("[create-checkout] Creating checkout", { 
      email: user.email, 
      userId: user.id,
      mode,
      plan: body.plan,
      price_id: body.price_id,
      purchase_type: body.purchase_type,
    });

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      console.error("[create-checkout] STRIPE_SECRET_KEY missing");
      return jsonResponse({ ok: false, error: "STRIPE_SECRET_KEY missing" }, 500);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-08-27.basil",
    });

    const frontendUrl =
      Deno.env.get("FRONTEND_URL") ||
      Deno.env.get("SITE_URL") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    let priceId: string;
    let metadata: Record<string, string> = {
      supabase_user_id: user.id,
      source: "billing-page",
    };

    // ===== MODE PAYMENT (Achat one-off, ex: Woofs packs) =====
    if (mode === 'payment') {
      priceId = body.price_id;
      
      if (!priceId) {
        return jsonResponse({ ok: false, error: "price_id requis pour mode payment" }, 400);
      }

      // Ajouter les metadata spécifiques au type d'achat
      metadata.purchase_type = body.purchase_type || 'one_off';
      metadata.affiliate_ref = body.affiliate_ref || '';
      
      // Ajouter les metadata additionnelles (brand_id, woofs_pack_size, etc.)
      if (body.metadata) {
        Object.entries(body.metadata).forEach(([key, value]) => {
          metadata[key] = String(value);
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata,
        allow_promotion_codes: true,
        success_url: `${frontendUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}&type=${body.purchase_type || 'one_off'}`,
        cancel_url: `${frontendUrl}/billing?payment=cancelled`,
      });

      return jsonResponse({ ok: true, url: session.url });
    }

    // ===== MODE SUBSCRIPTION (Abonnement mensuel/annuel) =====
    const { plan, billing_period, brand_name, affiliate_ref } = body;

    if (!plan) {
      return jsonResponse({ ok: false, error: "plan requis pour mode subscription" }, 400);
    }

    const billingType = billing_period === "annual" ? "annual" : "monthly";
    const planType = plan as keyof typeof SUBSCRIPTION_PRICE_IDS["monthly"];
    priceId = SUBSCRIPTION_PRICE_IDS[billingType][planType];

    if (!priceId) {
      console.error("[create-checkout] Invalid plan or billing period", { plan, billing_period });
      return jsonResponse({ ok: false, error: "Invalid plan selection" }, 400);
    }

    metadata = {
      ...metadata,
      plan,
      billing_period: billingType,
      brand_name: brand_name || "",
      affiliate_ref: affiliate_ref || "",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata,
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
