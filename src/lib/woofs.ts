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

export function getWoofCost(type: WoofCostType): number {
  return WOOF_COSTS[type];
}

export function getPlanWoofs(plan: PlanType): number {
  return PLAN_WOOFS[plan];
}

/**
 * Calcule le coût total en Woofs pour un pack d'assets
 * @param pack Le pack Alfie contenant les assets
 * @param selectedAssetIds Les IDs des assets sélectionnés (optionnel, tous si vide)
 * @returns Le coût total en Woofs
 */
export function calculatePackWoofCost(
  pack: { assets: Array<{ id: string; woofCostType: WoofCostType; count?: number }> },
  selectedAssetIds?: string[]
): number {
  const assetsToCount = selectedAssetIds 
    ? pack.assets.filter((asset) => selectedAssetIds.includes(asset.id))
    : pack.assets;

  return assetsToCount.reduce((total, asset) => {
    const baseCost = getWoofCost(asset.woofCostType);
    // Pour les carrousels, multiplier par le nombre de slides
    const multiplier = asset.woofCostType === "carousel_slide" ? (asset.count || 1) : 1;
    return total + baseCost * multiplier;
  }, 0);
}

// Legacy function - now returns fixed cost of 6 Woofs for standard videos
export const WOOF_SECONDS = 12;

export function woofsForVideo(_durationSec?: number) {
  // All standard videos now cost 6 Woofs regardless of duration
  return WOOF_COSTS.video_basic;
}

/**
 * Protège contre les valeurs NaN ou undefined
 * Retourne toujours un nombre valide
 */
export const safeWoofs = (value: number | null | undefined): number =>
  Number.isFinite(value as number) ? (value as number) : 0;
