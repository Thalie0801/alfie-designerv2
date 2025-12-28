/**
 * Configuration centrale des coûts en Woofs pour Edge Functions
 * 
 * Système unifié : toutes les générations consomment des Woofs (🐶)
 * - 1 image = 1 Woof
 * - 1 carrousel complet = 10 Woofs
 * - 1 vidéo Veo 3.1 (6-8s, 1080p, audio) = 25 Woofs
 */

export const WOOF_COSTS = {
  image: 1,
  carousel: 10, // 10 Woofs par carrousel complet (5 slides texte + images de fond)
  video_premium: 25, // ✅ Veo 3.1 FAST (6-8s, 1080p, audio)
  video_basic: 1, // Deprecated - utilisé historiquement pour Sora/Seededance
} as const;

export const PLAN_WOOFS = {
  starter: 150,
  pro: 450,
  studio: 1000,
} as const;

export type WoofCostType = keyof typeof WOOF_COSTS;
export type PlanType = keyof typeof PLAN_WOOFS;
