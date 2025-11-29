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
export type WoofCostType = "image" | "carousel_slide" | "animated_image" | "video_basic" | "video_premium";

// PackAsset is now just UnifiedAlfieIntent with additional legacy fields
export interface PackAsset extends UnifiedAlfieIntent {
  format?: AssetFormat; // Legacy - kept for compatibility
  woofCostType: WoofCostType;
}

// Woof cost mapping
export const WOOF_COST_MAP: Record<AssetKind, number | 'perSlide'> = {
  image: 1,
  carousel: 'perSlide', // 1 par slide
  animated_image: 3,
  video_basic: 10,
  video_premium: 50,
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
