import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { requireEnv } from "../_shared/env.ts";
import type { Database } from "../_shared/database.types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_CONFIG = {
  starter: {
    quota_brands: 1,
    quota_images: 150,
    quota_videos: 15,
    quota_woofs: 150,
  },
  pro: {
    quota_brands: 3,
    quota_images: 450,
    quota_videos: 45,
    quota_woofs: 450,
  },
  studio: {
    quota_brands: 5,
    quota_images: 1000,
    quota_videos: 100,
    quota_woofs: 1000,
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
      requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return supabaseClient;
}

async function ensureUserExists(email: string) {
  const supabase = getSupabaseClient();
  
  const { data: listData, error: listUsersError } = await supabase.auth.admin.listUsers();
  
  if (listUsersError) {
    console.error("[verify-session] Error listing users:", listUsersError);
  }
  
  const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  if (existingUser) {
    return existingUser.id;
  }

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

  console.log("[verify-session] Processing affiliate conversion", { affiliateRef, userId, plan });

  const supabase = getSupabaseClient();

  const { data: affiliateData, error: affiliateError } = await supabase
    .from("affiliates")
    .select("id")
    .eq("id", affiliateRef)
    .single();

  if (!affiliateData || affiliateError) {
    console.log("[verify-session] Affiliate not found", { affiliateError });
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
    console.error("[verify-session] Error creating conversion", conversionError);
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
    console.error("[verify-session] Error creating brand", error);
  }
}

async function handleWoofsPack(brandId: string, woofsAmount: number) {
  const supabase = getSupabaseClient();

  console.log("[verify-session] Adding Woofs pack to brand", { brandId, woofsAmount });

  // Récupérer le quota actuel
  const { data: brand, error: fetchError } = await supabase
    .from("brands")
    .select("quota_woofs")
    .eq("id", brandId)
    .single();

  if (fetchError) {
    console.error("[verify-session] Error fetching brand", fetchError);
    throw new Error(`Failed to fetch brand: ${fetchError.message}`);
  }

  const currentQuota = (brand as any)?.quota_woofs || 0;
  const newQuota = currentQuota + woofsAmount;

  // Mettre à jour le quota en utilisant une approche différente
  // On utilise from().upsert() au lieu de from().update()
  const { error: upsertError } = await supabase
    .from("brands")
    .upsert(
      {
        id: brandId,
        quota_woofs: newQuota,
      } as any,
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (upsertError) {
    console.error("[verify-session] Error updating brand quota", upsertError);
    throw new Error(`Failed to update brand quota: ${upsertError.message}`);
  }

  console.log("[verify-session] Successfully added Woofs pack", { brandId, newQuota });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return jsonResponse({ ok: false, error: "session_id is required" }, 400);
    }

    const stripeSecret = requireEnv("STRIPE_SECRET_KEY");
    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-08-27.basil" });

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return jsonResponse({ ok: false, error: "Session not found" }, 404);
    }

    if (session.payment_status !== "paid") {
      return jsonResponse({ ok: false, error: "Payment not completed" }, 400);
    }

    const purchaseType = session.metadata?.purchase_type as string | undefined;

    // ✅ NOUVEAU : Gérer l'achat de packs Woofs
    if (purchaseType === "woofs_pack") {
      const brandId = session.metadata?.brand_id as string | undefined;
      const woofsPackSize = session.metadata?.woofs_pack_size as string | undefined;

      if (!brandId || !woofsPackSize) {
        throw new Error("Missing brand_id or woofs_pack_size in metadata");
      }

      const woofsAmount = parseInt(woofsPackSize, 10);
      
      await handleWoofsPack(brandId, woofsAmount);

      return jsonResponse({ ok: true, brandId, woofsAdded: woofsAmount });
    }

    // Flux standard : abonnement
    const email = (session.customer_details?.email || session.metadata?.email) as string | undefined;
    const plan = session.metadata?.plan as keyof typeof PLAN_CONFIG | undefined;
    const affiliateRef = session.metadata?.affiliate_ref as string | undefined;
    const brandName = session.metadata?.brand_name as string | undefined;

    console.log("[verify-session] Processing session", { email, plan, session_id });

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

    const supabaseUserId = session.metadata?.supabase_user_id as string | undefined;

    // Si on a l'ID utilisateur dans les metadata, l'utiliser directement
    const userId = supabaseUserId || await ensureUserExists(email);

    await upsertProfile(userId, email, plan, session.customer as string, session.subscription as string);

    await createBrandIfNeeded(userId, brandName, session.subscription as string | undefined);

    await handleAffiliateConversion(
      affiliateRef,
      userId,
      plan,
      session.amount_total ? session.amount_total / 100 : 0,
    );

    return jsonResponse({ ok: true, userId });
  } catch (error: any) {
    console.error("[verify-session] Error processing session", error);
    return jsonResponse({ ok: false, error: error.message ?? "Unknown error" }, 500);
  }
});
