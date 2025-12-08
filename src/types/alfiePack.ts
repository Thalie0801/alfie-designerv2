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
export type WoofCostType = "image" | "carousel" | "video_premium";

// Types de carrousel
export type CarouselType = 'citations' | 'content';

// PackAsset is now just UnifiedAlfieIntent with additional legacy fields
export interface PackAsset extends UnifiedAlfieIntent {
  format?: AssetFormat; // Legacy - kept for compatibility
  woofCostType: WoofCostType;
  carouselType?: CarouselType; // Type de carrousel: citations ou contenu
}

// Woof cost mapping - carrousel = coût fixe de 10 Woofs
export const WOOF_COST_MAP: Record<AssetKind, number> = {
  image: 1,
  carousel: 10, // Coût fixe par carrousel (5 slides)
  video_premium: 25,
};

export function getWoofCost(asset: UnifiedAlfieIntent | PackAsset): number {
  return WOOF_COST_MAP[asset.kind];
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
