/**
 * Configuration des modèles IA par tier de plan
 * Standard (Starter 39€) : Flash - rapide, économique
 * Premium (Pro/Studio + Packs Woofs) : Pro - qualité max
 */

export type AITier = 'standard' | 'premium';

export interface AIModelsConfig {
  text: string;
  image: string;
}

export const AI_MODELS: Record<AITier, AIModelsConfig> = {
  standard: {
    text: 'google/gemini-2.5-flash',
    image: 'google/gemini-2.5-flash-image-preview',
  },
  premium: {
    text: 'google/gemini-2.5-pro',
    image: 'google/gemini-3-pro-image-preview',
  },
};

// Plans qui ont accès au tier Premium
const PREMIUM_PLANS = ['pro', 'studio', 'enterprise', 'admin'];

export function getTierFromPlan(plan: string | null | undefined, forcePremium?: boolean): AITier {
  // Packs Woofs achetés = toujours Premium
  if (forcePremium) return 'premium';
  if (!plan) return 'standard';
  return PREMIUM_PLANS.includes(plan.toLowerCase()) ? 'premium' : 'standard';
}

export function getModelsForPlan(plan: string | null | undefined, forcePremium?: boolean): AIModelsConfig {
  const tier = getTierFromPlan(plan, forcePremium);
  return AI_MODELS[tier];
}

export function getModelDescription(plan: string | null | undefined, forcePremium?: boolean): string {
  const tier = getTierFromPlan(plan, forcePremium);
  if (tier === 'premium') {
    return 'IA Premium (Gemini Pro) - Qualité maximum';
  }
  return 'IA Standard (Gemini Flash) - Rapide et efficace';
}

/**
 * Détermine si l'utilisateur a accès au tier Premium
 * via son plan OU via l'achat de packs Woofs
 */
export function hasPremiumAccess(plan: string | null | undefined, hasPurchasedPacks?: boolean): boolean {
  if (hasPurchasedPacks) return true;
  return getTierFromPlan(plan) === 'premium';
}
