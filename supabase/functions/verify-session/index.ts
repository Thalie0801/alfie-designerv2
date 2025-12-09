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

  console.log("[verify-session] Upserting profile:", { userId, email, plan, stripeSubscriptionId });

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email,
      plan,
      quota_brands: planConfig.quota_brands,
      quota_visuals_per_month: planConfig.quota_images, // Nom correct de la colonne
      quota_videos: planConfig.quota_videos,
      // quota_woofs retiré - géré par brands/counters_monthly
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status: "active",
    } as any)
    .eq("id", userId);
  
  if (error) {
    console.error("[verify-session] Profile upsert error:", error);
    throw new Error(`Profile upsert failed: ${error.message}`);
  }
  
  console.log("[verify-session] Profile upserted successfully for:", email);
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

type ConversionType = "subscription" | "upgrade" | "woofs_pack";

async function handleAffiliateConversion(
  affiliateRef: string | undefined | null,
  userId: string,
  conversionType: ConversionType,
  planOrSize: string,
  amount: number
) {
  console.log("[verify-session] handleAffiliateConversion called:", { affiliateRef, userId, conversionType, planOrSize, amount });
  
  if (!affiliateRef) {
    console.log("[verify-session] No affiliate ref provided, skipping conversion");
    return;
  }

  // Format plan field: "subscription:starter", "upgrade:pro", "woofs_pack:100"
  const planLabel = `${conversionType}:${planOrSize}`;

  console.log("[verify-session] Processing affiliate conversion", { affiliateRef, userId, planLabel, amount });

  const supabase = getSupabaseClient();

  // Try to find affiliate by ID or slug
  let affiliateId: string | null = null;
  let affiliateEmail: string | null = null;
  
  // Check if ref is a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(affiliateRef);
  console.log("[verify-session] Affiliate ref type:", { affiliateRef, isUUID });
  
  if (isUUID) {
    // First try by ID
    const { data: affiliateById, error: idError } = await supabase
      .from("affiliates")
      .select("id, email")
      .eq("id", affiliateRef)
      .single();

    if (idError) {
      console.log("[verify-session] Error finding affiliate by ID:", idError);
    }

    if (affiliateById) {
      affiliateId = (affiliateById as any).id;
      affiliateEmail = (affiliateById as any).email;
      console.log("[verify-session] Found affiliate by ID:", { affiliateId, affiliateEmail });
    }
  }
  
  if (!affiliateId) {
    // Try by slug
    const { data: affiliateBySlug, error: slugError } = await supabase
      .from("affiliates")
      .select("id, email")
      .eq("slug", affiliateRef)
      .single();
    
    if (slugError) {
      console.log("[verify-session] Error finding affiliate by slug:", slugError);
    }
    
    if (affiliateBySlug) {
      affiliateId = (affiliateBySlug as any).id;
      affiliateEmail = (affiliateBySlug as any).email;
      console.log("[verify-session] Found affiliate by slug:", { affiliateId, affiliateEmail });
    }
  }

  if (!affiliateId) {
    console.error("[verify-session] Affiliate not found for ref:", affiliateRef);
    return;
  }

  console.log("[verify-session] Creating conversion for affiliate:", { affiliateId, affiliateEmail, userId, planLabel, amount });

  const { data: conversionData, error: conversionError } = await supabase
    .from("affiliate_conversions")
    .insert({
      affiliate_id: affiliateId,
      user_id: userId,
      plan: planLabel,
      amount,
      status: "paid",
    } as any)
    .select()
    .single();

  if (conversionError) {
    console.error("[verify-session] Error creating conversion:", conversionError);
    return;
  }

  console.log("[verify-session] Conversion created successfully:", conversionData);

  if (conversionData) {
    const conversionId = (conversionData as any).id as string;
    
    console.log("[verify-session] Calculating MLM commissions for conversion:", conversionId);
    
    const { error: rpcError } = await supabase.rpc("calculate_mlm_commissions", {
      conversion_id_param: conversionId,
      direct_affiliate_id: affiliateId,
      conversion_amount: amount,
    } as any);

    if (rpcError) {
      console.error("[verify-session] Error calculating commissions:", rpcError);
    } else {
      console.log("[verify-session] Commissions calculated successfully");
    }

    const { error: statusError } = await supabase.rpc("update_affiliate_status", { 
      affiliate_id_param: affiliateId
    } as any);

    if (statusError) {
      console.error("[verify-session] Error updating affiliate status:", statusError);
    } else {
      console.log("[verify-session] Affiliate status updated successfully");
    }
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

// Mapping des bonus Woofs (pack affiché → Woofs réellement crédités)
const WOOFS_PACK_ACTUAL: Record<number, number> = {
  50: 50,
  100: 100,
  250: 250,
  500: 600, // +100 bonus gratuits
};

async function handleWoofsPack(brandId: string, woofsPackSize: number) {
  const supabase = getSupabaseClient();

  // Appliquer le bonus si applicable
  const actualWoofs = WOOFS_PACK_ACTUAL[woofsPackSize] ?? woofsPackSize;
  console.log("[verify-session] Adding Woofs pack to brand", { brandId, woofsPackSize, actualWoofs });

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
  const newQuota = currentQuota + actualWoofs;

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

  console.log("[verify-session] Successfully added Woofs pack", { brandId, actualWoofs, newQuota });
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

    // ✅ Gérer l'achat de packs Woofs avec affiliation
    if (purchaseType === "woofs_pack") {
      const brandId = session.metadata?.brand_id as string | undefined;
      const woofsPackSize = session.metadata?.woofs_pack_size as string | undefined;
      const affiliateRef = session.metadata?.affiliate_ref as string | undefined;
      const supabaseUserId = session.metadata?.supabase_user_id as string | undefined;

      if (!brandId || !woofsPackSize) {
        throw new Error("Missing brand_id or woofs_pack_size in metadata");
      }

      const baseWoofsSize = parseInt(woofsPackSize, 10);
      const actualWoofs = WOOFS_PACK_ACTUAL[baseWoofsSize] ?? baseWoofsSize;
      const amount = session.amount_total ? session.amount_total / 100 : 0;
      
      // Ajouter les Woofs à la marque (avec bonus si applicable)
      await handleWoofsPack(brandId, baseWoofsSize);

      // Traiter l'affiliation si présente
      if (affiliateRef && supabaseUserId) {
        await handleAffiliateConversion(
          affiliateRef,
          supabaseUserId,
          "woofs_pack",
          woofsPackSize,
          amount
        );
        console.log("[verify-session] Affiliate conversion processed for Woofs pack", { affiliateRef, amount });
      }

      return jsonResponse({ ok: true, brandId, woofsAdded: actualWoofs, affiliateProcessed: !!affiliateRef });
    }

    // Flux standard : abonnement ou upgrade
    const email = (session.customer_details?.email || session.metadata?.email) as string | undefined;
    const plan = session.metadata?.plan as keyof typeof PLAN_CONFIG | undefined;
    const affiliateRef = session.metadata?.affiliate_ref as string | undefined;
    const brandName = session.metadata?.brand_name as string | undefined;
    const upgradeFrom = session.metadata?.upgrade_from as string | undefined;

    console.log("[verify-session] Processing session", { email, plan, session_id, upgradeFrom });

    if (!email) {
      throw new Error("Missing customer email on checkout session");
    }

    if (!plan || !PLAN_CONFIG[plan]) {
      throw new Error(`Invalid plan on checkout session: ${plan}`);
    }

    // Déterminer le type de conversion
    const conversionType: ConversionType = upgradeFrom ? "upgrade" : "subscription";

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
      conversionType,
      plan,
      session.amount_total ? session.amount_total / 100 : 0,
    );

    // ✅ Envoyer l'email de bienvenue (non-bloquant)
    try {
      const supabase = getSupabaseClient();
      await supabase.functions.invoke("send-confirmation-email", {
        body: { email, plan },
      });
      console.log("[verify-session] Welcome email sent to:", email);
    } catch (emailError) {
      console.error("[verify-session] Failed to send welcome email:", emailError);
    }

    return jsonResponse({ ok: true, userId });
  } catch (error: any) {
    console.error("[verify-session] Error processing session", error);
    return jsonResponse({ ok: false, error: error.message ?? "Unknown error" }, 500);
  }
});
