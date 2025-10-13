import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingPlan = "starter" | "pro" | "studio";

type PlanConfig = {
  label: string;
  priceIdEnv: string;
  quotas: {
    images: number;
    reels: number;
    woofs: number;
  };
};

export const PLAN_CONFIG: Record<BillingPlan, PlanConfig> = {
  starter: {
    label: "Starter",
    priceIdEnv: "STRIPE_PRICE_STARTER",
    quotas: { images: 150, reels: 20, woofs: 20 },
  },
  pro: {
    label: "Pro",
    priceIdEnv: "STRIPE_PRICE_PRO",
    quotas: { images: 450, reels: 60, woofs: 60 },
  },
  studio: {
    label: "Studio",
    priceIdEnv: "STRIPE_PRICE_STUDIO",
    quotas: { images: 1000, reels: 120, woofs: 120 },
  },
};

export function resolvePlanFromPrice(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) {
    return null;
  }
  const normalized = priceId.trim();
  const entry = Object.entries(PLAN_CONFIG).find(([, config]) => {
    const envValue = process.env[config.priceIdEnv];
    return envValue && envValue === normalized;
  });
  return (entry?.[0] as BillingPlan | undefined) ?? null;
}

export async function creditMonthlyQuotas(
  client: SupabaseClient,
  userId: string,
  plan: BillingPlan
) {
  const config = PLAN_CONFIG[plan];
  if (!config) {
    return;
  }

  const now = new Date().toISOString();

  await client
    .from("profiles")
    .update({
      plan,
      quota_visuals_per_month: config.quotas.images,
      quota_videos: config.quotas.reels,
      ai_credits_monthly: config.quotas.woofs,
      alfie_requests_this_month: 0,
    })
    .eq("id", userId);

  await client
    .from("brands")
    .update({
      plan,
      quota_images: config.quotas.images,
      quota_videos: config.quotas.reels,
      quota_woofs: config.quotas.woofs,
      resets_on: now,
    })
    .eq("user_id", userId);
}
