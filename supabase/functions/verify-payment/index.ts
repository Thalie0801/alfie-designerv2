import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { requireEnv } from "../_shared/env.ts";

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

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  return supabaseClient;
}

async function ensureUserExists(email: string) {
  const supabase = getSupabaseClient();
  const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
  if (existingUser?.user) {
    return existingUser.user.id;
  }

  const tempPassword = crypto.randomUUID();
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`User creation failed: ${error.message}`);
  }

  return created.user.id;
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

  await supabase
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
    })
    .eq("id", userId);
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
      },
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

  const { data: affiliate, error: affiliateError } = await supabase
    .from("affiliates")
    .select("id")
    .eq("id", affiliateRef)
    .single();

  if (!affiliate || affiliateError) {
    console.log("[verify-payment] Affiliate not found", { affiliateError });
    return;
  }

  const { data: conversion, error: conversionError } = await supabase
    .from("affiliate_conversions")
    .insert({
      affiliate_id: affiliate.id,
      user_id: userId,
      plan,
      amount,
      status: "paid",
    })
    .select()
    .single();

  if (conversionError) {
    console.error("[verify-payment] Error creating conversion", conversionError);
    return;
  }

  await supabase.rpc("calculate_mlm_commissions", {
    conversion_id_param: conversion.id,
    direct_affiliate_id: affiliate.id,
    conversion_amount: amount,
  });

  await supabase.rpc("update_affiliate_status", { affiliate_id_param: affiliate.id });
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
  });

  if (error) {
    console.error("[verify-payment] Error creating brand", error);
  }
}

async function processCheckoutSession(session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email || session.metadata?.email) as string | undefined;
  const plan = session.metadata?.plan as keyof typeof PLAN_CONFIG | undefined;
  const billingPeriod = session.metadata?.billing_period;
  const affiliateRef = session.metadata?.affiliate_ref as string | undefined;
  const brandName = session.metadata?.brand_name as string | undefined;

  console.log("[verify-payment] checkout.session.completed", { email, plan, billingPeriod });

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

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-11-20" });

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
        await processCheckoutSession(session);
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
