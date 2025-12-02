/**
 * Unified Alfie Intent Types - Phase 1
 * Single source of truth for all content generation intents
 */

export type AssetKind = 'image' | 'carousel' | 'video_premium';
export type Platform = 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'facebook' | 'pinterest' | 'generic';
export type Ratio = '1:1' | '4:5' | '9:16' | '16:9';
export type Goal = 'education' | 'vente' | 'lead' | 'engagement' | 'notoriete';

export interface GeneratedTexts {
  slides?: Array<{ title: string; subtitle?: string; bullets?: string[] }>;
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
  withAudio?: boolean; // vidéos uniquement - générer avec audio (défaut: true)
  campaign?: string;
  copyBrief?: string; // Brief libre optionnel
}

// Legacy aliases for backward compatibility
export type AlfieIntent = UnifiedAlfieIntent;
export type AlfieFormat = 'image' | 'carousel';
