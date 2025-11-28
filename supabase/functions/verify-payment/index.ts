import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { requireEnv } from "../_shared/env.ts";
import type { Database } from "../_shared/database.types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: restrict to frontend domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_CONFIG = {
  starter: {
    quota_brands: 1,
    quota_images: 150,
    quota_videos: 15,
    quota_woofs: 15,
  },
  pro: {
    quota_brands: 1,
    quota_images: 450,
    quota_videos: 45,
    quota_woofs: 45,
  },
  studio: {
    quota_brands: 1,
    quota_images: 1000,
    quota_videos: 100,
    quota_woofs: 100,
  },
  enterprise: {
    quota_brands: 999,
    quota_images: 9999,
    quota_videos: 9999,
    quota_woofs: 9999,
  },
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  return supabaseClient;
}

async function ensureUserExists(email: string) {
  const supabase = getSupabaseClient();
  
  // Liste tous les users et filtre par email
  const { data: listData, error: listUsersError } = await supabase.auth.admin.listUsers();
  
  if (listUsersError) {
    console.error("[verify-payment] Error listing users:", listUsersError);
  }
  
  const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (existingUser) {
    return existingUser.id;
  }

  // Créer l'utilisateur s'il n'existe pas
  const tempPassword = crypto.randomUUID();
  const { data: createData, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createUserError || !createData?.user) {
    throw new Error(`User creation failed: ${createUserError?.message || 'Unknown error'}`);
  }

  return createData.user.id;
}

async function upsertProfile(
  userId: string,
  email: string,
  plan: keyof typeof PLAN_CONFIG,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
) {
  const planConfig = PLAN_CONFIG[plan];

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email,
      plan,
      quota_brands: planConfig.quota_brands,
      quota_images: planConfig.quota_images,
      quota_videos: planConfig.quota_videos,
      quota_woofs: planConfig.quota_woofs,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status: "active",
    } as any)
    .eq("id", userId);
  
  if (error) {
    throw new Error(`Profile upsert failed: ${error.message}`);
  }
}

async function insertPaymentSession(sessionId: string, email: string, plan: string, amount?: number) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("payment_sessions")
    .upsert(
      {
        session_id: sessionId,
        email,
        plan,
        verified: true,
        amount: amount ?? 0,
      } as any,
      { onConflict: "session_id", ignoreDuplicates: false },
    );

  if (error && error.code !== "23505") {
    throw new Error(`Failed to record payment session: ${error.message}`);
  }
}

async function handleAffiliateConversion(affiliateRef: string | undefined | null, userId: string, plan: string, amount: number) {
  if (!affiliateRef) return;

  console.log("[verify-payment] Processing affiliate conversion", { affiliateRef, userId, plan });

  const supabase = getSupabaseClient();

  const { data: affiliateData, error: affiliateError } = await supabase
    .from("affiliates")
    .select("id")
    .eq("id", affiliateRef)
    .single();

  if (!affiliateData || affiliateError) {
    console.log("[verify-payment] Affiliate not found", { affiliateError });
    return;
  }

  const affiliateId = (affiliateData as any).id as string;

  const { data: conversionData, error: conversionError } = await supabase
    .from("affiliate_conversions")
    .insert({
      affiliate_id: affiliateId,
      user_id: userId,
      plan,
      amount,
      status: "paid",
    } as any)
    .select()
    .single();

  if (conversionError) {
    console.error("[verify-payment] Error creating conversion", conversionError);
    return;
  }

  if (conversionData) {
    const conversionId = (conversionData as any).id as string;
    
    await supabase.rpc("calculate_mlm_commissions", {
      conversion_id_param: conversionId,
      direct_affiliate_id: affiliateId,
      conversion_amount: amount,
    } as any);

    await supabase.rpc("update_affiliate_status", { 
      affiliate_id_param: affiliateId
    } as any);
  }
}

async function createBrandIfNeeded(userId: string, brandName?: string | null, subscriptionId?: string | null) {
  if (!brandName) return;

  const starter = PLAN_CONFIG.starter;

  const supabase = getSupabaseClient();

  const { error } = await supabase.from("brands").insert({
    user_id: userId,
    name: brandName,
    plan: "starter",
    is_addon: true,
    quota_images: starter.quota_images,
    quota_videos: starter.quota_videos,
    quota_woofs: starter.quota_woofs,
    stripe_subscription_id: subscriptionId ?? undefined,
  } as any);

  if (error) {
    console.error("[verify-payment] Error creating brand", error);
  }
}

async function assignAmbassadorRole(userId: string) {
  const supabase = getSupabaseClient();
  
  // Check if role already exists
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "ambassadeur")
    .maybeSingle();
  
  if (existing) {
    console.log("[verify-payment] User already has ambassadeur role");
    return;
  }
  
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "ambassadeur" } as any);
  
  if (error) {
    console.error("[verify-payment] Error assigning ambassadeur role:", error);
  } else {
    console.log("[verify-payment] Ambassadeur role assigned to:", userId);
  }
}

async function addBadge(userId: string, badge: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from("user_badges")
    .upsert(
      { user_id: userId, badge } as any,
      { onConflict: "user_id,badge", ignoreDuplicates: true }
    );
  
  if (error && error.code !== "23505") {
    console.error("[verify-payment] Error adding badge:", error);
  } else {
    console.log("[verify-payment] Badge added:", badge, "for user:", userId);
  }
}

async function processCheckoutSession(session: Stripe.Checkout.Session, stripe: Stripe) {
  const email = (session.customer_details?.email || session.metadata?.email) as string | undefined;
  const plan = session.metadata?.plan as keyof typeof PLAN_CONFIG | undefined;
  const billingPeriod = session.metadata?.billing_period;
  const affiliateRef = session.metadata?.affiliate_ref as string | undefined;
  const brandName = session.metadata?.brand_name as string | undefined;

  console.log("[verify-payment] checkout.session.completed", { email, plan, billingPeriod });

  // Detect AMBASSADEUR promo code usage
  let usedAmbassadorCode = false;
  
  if (session.total_details?.breakdown?.discounts) {
    for (const discount of session.total_details.breakdown.discounts) {
      if (discount.discount?.promotion_code) {
        const promoCodeId = discount.discount.promotion_code as string;
        const promoCode = await stripe.promotionCodes.retrieve(promoCodeId);
        
        if (promoCode.code?.toUpperCase() === "AMBASSADEUR") {
          usedAmbassadorCode = true;
          console.log("[verify-payment] AMBASSADEUR promo code detected!");
          break;
        }
      }
    }
  }

  if (!email) {
    throw new Error("Missing customer email on checkout session");
  }

  if (!plan || !PLAN_CONFIG[plan]) {
    throw new Error(`Invalid plan on checkout session: ${plan}`);
  }

  await insertPaymentSession(
    session.id,
    email,
    plan,
    session.amount_total ? session.amount_total / 100 : 0,
  );

  const userId = await ensureUserExists(email);

  await upsertProfile(userId, email, plan, session.customer as string, session.subscription as string);

  await createBrandIfNeeded(userId, brandName, session.subscription as string | undefined);

  // Assign ambassador role and badge if AMBASSADEUR code was used
  if (usedAmbassadorCode) {
    await assignAmbassadorRole(userId);
    await addBadge(userId, "ambassadeur");
  }

  await handleAffiliateConversion(
    affiliateRef,
    userId,
    plan,
    session.amount_total ? session.amount_total / 100 : 0,
  );

  const supabase = getSupabaseClient();

  await supabase.functions.invoke("send-confirmation-email", {
    body: {
      email,
      plan,
      session_id: session.id,
      billing_period: billingPeriod,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret) {
    console.error("[verify-payment] STRIPE_SECRET_KEY missing");
    return jsonResponse({ ok: false, error: "STRIPE_SECRET_KEY missing" }, 500);
  }

  if (!webhookSecret) {
    console.error("[verify-payment] STRIPE_WEBHOOK_SECRET missing");
    return jsonResponse({ ok: false, error: "STRIPE_WEBHOOK_SECRET missing" }, 500);
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2025-08-27.basil" });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    console.error("[verify-payment] Missing stripe-signature header");
    return jsonResponse({ ok: false, error: "Missing stripe-signature header" }, 400);
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("[verify-payment] Signature verification failed", err);
    return jsonResponse({ ok: false, error: "Invalid webhook signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Retrieve session with discount details
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['total_details.breakdown.discounts'],
        });
        
        await processCheckoutSession(fullSession, stripe);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("[verify-payment] invoice.paid", {
          email: invoice.customer_email,
          subscription: invoice.subscription,
        });
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[verify-payment] customer.subscription.updated", {
          subscription: subscription.id,
          status: subscription.status,
        });
        break;
      }
      default: {
        console.log("[verify-payment] Unhandled event", { type: event.type });
      }
    }

    return jsonResponse({ ok: true });
  } catch (error: any) {
    console.error("[verify-payment] Error processing event", error);
    return jsonResponse({ ok: false, error: error.message ?? "Unknown error" }, 500);
  }
});
