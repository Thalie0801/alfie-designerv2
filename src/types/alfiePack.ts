/**
 * Pack Types - Simplified to use UnifiedAlfieIntent
 */

import type { UnifiedAlfieIntent, AssetKind } from '@/lib/types/alfie';

// Re-export for convenience
export type { AssetKind, Platform, Ratio, Goal, GeneratedTexts } from '@/lib/types/alfie';

// Legacy type mappings
export type PackAssetKind = AssetKind;
export type AssetFormat = "post" | "story" | "reel" | "short" | "pin";
export type AssetGoal = "education" | "vente" | "lead" | "engagement";
export type WoofCostType = "image" | "carousel_slide" | "carousel_slide_premium" | "video_premium";

// Types de carrousel
export type CarouselType = 'citations' | 'content';
export type CarouselMode = 'standard' | 'premium';

// PackAsset is now just UnifiedAlfieIntent with additional legacy fields
export interface PackAsset extends UnifiedAlfieIntent {
  format?: AssetFormat; // Legacy - kept for compatibility
  woofCostType: WoofCostType;
  carouselType?: CarouselType; // Type de carrousel: citations ou contenu
  carouselMode?: CarouselMode; // Mode de rendu: standard (overlay) ou premium (texte intégré)
}

// Woof cost mapping
export const WOOF_COST_MAP: Record<AssetKind, number | 'perSlide'> = {
  image: 1,
  carousel: 'perSlide',
  video_premium: 25,
};

export function getWoofCost(asset: UnifiedAlfieIntent | PackAsset): number {
  const costType = WOOF_COST_MAP[asset.kind];
  if (costType === 'perSlide') return asset.count;
  return costType;
}

export interface AlfiePack {
  title: string;
  summary: string;
  assets: PackAsset[];
}

export interface AlfieWidgetResponse {
  reply: string;
  pack: AlfiePack | null;
}
