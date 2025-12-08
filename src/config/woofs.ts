/**
 * Configuration centrale des coûts en Woofs pour toutes les générations
 * 
 * Système unifié : toutes les générations consomment des Woofs (🐶)
 * - 1 image = 1 Woof
 * - 1 slide de carrousel = 1 Woof
 * - 1 vidéo animée standard = 6 Woofs
 * - 1 vidéo premium (Veo 3.1) = 25 Woofs
 */

export const WOOF_COSTS = {
  image: 1,
  carousel_slide: 1,
  carousel_slide_premium: 3, // ✅ Mode Premium (Gemini 3 Pro) = 3 Woofs
  video_premium: 25,
} as const;

export const PLAN_WOOFS = {
  starter: 150,
  pro: 450,
  studio: 1000,
} as const;

export type WoofCostType = keyof typeof WOOF_COSTS;
export type PlanType = keyof typeof PLAN_WOOFS;

export function getWoofCost(type: WoofCostType): number {
  return WOOF_COSTS[type];
}

export function getPlanWoofs(plan: PlanType): number {
  return PLAN_WOOFS[plan];
}
