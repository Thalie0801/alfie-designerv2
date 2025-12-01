/**
 * Configuration centrale des coûts en Woofs pour Edge Functions
 * 
 * Système unifié : toutes les générations consomment des Woofs (🐶)
 * - 1 image = 1 Woof
 * - 1 slide de carrousel = 1 Woof
 * - 1 vidéo animée standard = 10 Woofs
 * - 1 vidéo premium (Veo 3.1) = 50 Woofs
 */

export const WOOF_COSTS = {
  image: 1,
  carousel_slide: 1,
  video_basic: 6,
  video_premium: 25,
} as const;

export const PLAN_WOOFS = {
  starter: 150,
  pro: 450,
  studio: 1000,
} as const;

export type WoofCostType = keyof typeof WOOF_COSTS;
export type PlanType = keyof typeof PLAN_WOOFS;
