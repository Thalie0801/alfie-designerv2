/**
 * Configuration des modèles IA par tier de plan
 * Standard (Starter 39€) : Flash - rapide, économique
 * Premium (Pro/Studio) : Pro - qualité max
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

export function getTierFromPlan(plan: string | null | undefined): AITier {
  if (!plan) return 'standard';
  return PREMIUM_PLANS.includes(plan.toLowerCase()) ? 'premium' : 'standard';
}

export function getModelsForPlan(plan: string | null | undefined): AIModelsConfig {
  const tier = getTierFromPlan(plan);
  return AI_MODELS[tier];
}

export function getModelDescription(plan: string | null | undefined): string {
  const tier = getTierFromPlan(plan);
  if (tier === 'premium') {
    return 'IA Premium (Gemini Pro) - Qualité maximum';
  }
  return 'IA Standard (Gemini Flash) - Rapide et efficace';
}
