/**
 * Configuration centrale des coûts en Woofs pour Edge Functions
 * 
 * Système unifié : toutes les générations consomment des Woofs (🐶)
 * - 1 image = 1 Woof
 * - 1 slide de carrousel = 1 Woof
 * - 1 asset vidéo (6s, Veo 3.1) = 25 Woofs
 */

export const WOOF_COSTS = {
  image: 1,
  carousel: 10, // ✅ 10 Woofs par carrousel complet (5 slides texte + images de fond)
  video_premium: 25,
} as const;

export const PLAN_WOOFS = {
  starter: 150,
  pro: 450,
  studio: 1000,
} as const;

export type WoofCostType = keyof typeof WOOF_COSTS;
export type PlanType = keyof typeof PLAN_WOOFS;
