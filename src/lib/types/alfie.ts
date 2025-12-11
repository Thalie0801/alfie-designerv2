/**
 * Unified Alfie Intent Types - Phase 1
 * Single source of truth for all content generation intents
 */

export type AssetKind = 'image' | 'carousel' | 'video_premium';
export type Platform = 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest' | 'generic';
export type Ratio = '1:1' | '4:5' | '9:16' | '16:9' | '2:3';
export type Goal = 'education' | 'vente' | 'lead' | 'engagement' | 'notoriete';

// ✅ NEW: Visual style category for adaptive generation
export type VisualStyleCategory = 'background' | 'character' | 'product';

// Visual styles for image generation
export type VisualStyle = 
  | 'photorealistic' 
  | 'cinematic_photorealistic'
  | '3d_pixar_style'
  | 'flat_illustration'
  | 'minimalist_vector'
  | 'digital_painting'
  | 'comic_book';

export interface GeneratedTexts {
  slides?: Array<{ title: string; subtitle?: string; body?: string; bullets?: string[]; author?: string }>;
  text?: { title: string; body: string; cta?: string };
  video?: { hook: string; script: string; cta?: string };
}

export interface UnifiedAlfieIntent {
  id: string;
  brandId: string;
  kind: AssetKind;
  count: number; // slides pour carousel, 1 pour le reste
  platform: Platform;
  ratio: Ratio;
  title: string;
  goal: Goal;
  tone: string;
  prompt: string;
  durationSeconds?: number; // vidéos uniquement
  referenceImageUrl?: string;
  generatedTexts?: GeneratedTexts;
  useBrandKit?: boolean;
  visualStyle?: VisualStyle; // Style visuel pour la génération d'images
  visualStyleCategory?: VisualStyleCategory; // ✅ NEW: Fond/Personnage/Produit
  campaign?: string;
  copyBrief?: string; // Brief libre optionnel
}

// Legacy aliases for backward compatibility
export type AlfieIntent = UnifiedAlfieIntent;
export type AlfieFormat = 'image' | 'carousel';
