/**
 * Types pour le module VISION d'Alfie Designer
 * Transforme les intents utilisateur en prompts structurés
 */

export type VisualStyle = 
  | 'photorealistic' 
  | 'cinematic_photorealistic'
  | '3d_pixar_style'
  | 'flat_illustration'
  | 'minimalist_vector'
  | 'digital_painting'
  | 'comic_book';

export type VisionTarget = 'gemini_image' | 'replicate' | 'veo_3_1';
export type VisionKind = 'image' | 'carousel' | 'video_standard' | 'video_premium';
export type TextSource = 'ai' | 'user';

export interface TextLayout {
  has_title: boolean;
  has_body: boolean;
  has_cta: boolean;
  has_subtitles?: boolean;
  layout_hint: string;
  safe_zones?: Array<{
    id: string;
    zone_hint: string;
    description: string;
  }>;
}

export interface ImageSpec {
  prompt: string;
  negative_prompt: string;
  aspect_ratio: string;
  image_size: string;
  count: number;
  style: VisualStyle;
  text_layout: TextLayout;
  text_source: TextSource;
}

export interface CarouselSlide {
  id: string;
  role: 'hook' | 'problem' | 'insight' | 'solution' | 'proof' | 'cta' | 'summary';
  image: ImageSpec;
  text_layout: TextLayout;
  text_source: TextSource;
}

export interface VideoBeat {
  id: string;
  time_range: [number, number];
  description: string;
  camera?: string;
}

export interface VideoSpec {
  title: string;
  duration_seconds: number;
  aspect_ratio: string;
  style: VisualStyle;
  scenario: {
    one_liner: string;
    beats: VideoBeat[];
  };
  visual_prompt: string;
  negative_prompt: string;
  text_layout: TextLayout;
  text_source: TextSource;
}

export interface VisionMeta {
  campaign_name?: string;
  platform: string;
  brand_name?: string;
  use_brand_kit: boolean;
}

export interface VisionOutput {
  engine: 'visual';
  kind: VisionKind;
  target: VisionTarget;
  model?: string;
  meta: VisionMeta;
  images?: ImageSpec[];
  slides?: CarouselSlide[];
  video?: VideoSpec;
  overlays?: Array<{
    id: string;
    zone_hint?: string;
    description: string;
  }>;
}

export interface VisionRequest {
  intent: {
    kind: 'image' | 'carousel' | 'video_standard' | 'video_premium';
    platform: string;
    ratio?: string;
    goal?: string;
    tone?: string;
    prompt: string;
    count?: number;
    slidesCount?: number;
    durationSeconds?: number;
    style?: string;
  };
  brand: {
    name?: string;
    colors?: { 
      primary?: string; 
      secondary?: string; 
      accent?: string;
      background?: string;
    };
    voice?: string;
    niche?: string;
    useBrandKit: boolean;
  };
  memory?: {
    previousCampaigns?: string[];
    preferences?: Record<string, any>;
  };
  textSource?: TextSource;
}
