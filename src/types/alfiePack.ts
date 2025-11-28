/**
 * Types pour le système de packs de génération Alfie
 * Utilisé par le Chat Widget pour proposer des packs de visuels structurés
 */

export type PackAssetKind = "image" | "carousel" | "video_basic" | "video_premium";
export type Platform = "instagram" | "tiktok" | "youtube" | "linkedin" | "facebook" | "pinterest" | "generic";
export type AssetFormat = "post" | "story" | "reel" | "short" | "pin";
export type AssetGoal = "education" | "vente" | "lead" | "engagement";
export type WoofCostType = "image" | "carousel_slide" | "video_basic" | "video_premium";

export interface PackAsset {
  id: string;
  kind: PackAssetKind;
  count: number; // nombre de slides pour carousel, 1 pour les autres
  platform: Platform;
  format: AssetFormat;
  ratio: "1:1" | "4:5" | "9:16" | "16:9";
  durationSeconds?: number; // pour vidéos seulement
  title: string;
  goal: AssetGoal;
  tone: string;
  prompt: string;
  woofCostType: WoofCostType;
  referenceImageUrl?: string; // URL de l'image de référence optionnelle
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
