export type PlanKey = 'Starter' | 'Pro' | 'Studio';
export interface Plan {
  imagesPerMonth: number;
  reelsPerMonth: number;
  woofsIncluded: number;
}
export interface CountingInput {
  format: 'image'|'carousel'|'reel';
  aiImagesUsed?: number;     // nb d'images IA générées/retouchées (incl. carrousel)
  exports?: number;          // nb d'exports pour reel
  premiumT2V?: boolean;      // true si Premium T2V (Veo/Sora)
}
export interface Delta { images: number; reels: number; woofs: number; }

export function countingRules(input: CountingInput): Delta {
  const ai = Math.max(0, input.aiImagesUsed ?? 0);
  const exp = Math.max(0, input.exports ?? 0);
  switch (input.format) {
    case 'image':
      return { images: ai > 0 ? ai : 0, reels: 0, woofs: 0 };
    case 'carousel':
      return { images: ai, reels: 0, woofs: 0 };
    case 'reel':
      return { images: 0, reels: exp > 0 ? exp : 1, woofs: input.premiumT2V ? 1 : 0 };
    default:
      return { images: 0, reels: 0, woofs: 0 };
  }
}

export function willExceed(
  current: { images: number; reels: number; woofs: number },
  delta: Delta,
  plan: Plan
) {
  return {
    images: current.images + delta.images > plan.imagesPerMonth,
    reels:  current.reels  + delta.reels  > plan.reelsPerMonth,
    woofs:  current.woofs  + delta.woofs  > plan.woofsIncluded
  };
}

export function threshold80(
  current: { images: number; reels: number; woofs: number },
  plan: Plan
) {
  return {
    images: current.images >= Math.floor(plan.imagesPerMonth * 0.8),
    reels:  current.reels  >= Math.floor(plan.reelsPerMonth * 0.8),
    woofs:  current.woofs  >= Math.floor(plan.woofsIncluded * 0.8)
  };
}

// Helpers (pseudo‑DB)
export async function incrementCountersMonthly(
  brandId: string,
  periodYYYYMM: number,
  delta: Delta
) {
  // upsert counters_monthly(brand_id, period_yyyymm)
  // then set images_used += delta.images, etc.
}
