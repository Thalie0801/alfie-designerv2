/**
 * Types partagés pour le module VISION (Deno-compatible)
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

/**
 * Validation basique du VisionOutput
 */
export function validateVisionOutput(output: any): output is VisionOutput {
  if (!output || typeof output !== 'object') return false;
  if (output.engine !== 'visual') return false;
  if (!['image', 'carousel', 'video_standard', 'video_premium'].includes(output.kind)) return false;
  if (!['gemini_image', 'replicate', 'veo_3_1'].includes(output.target)) return false;
  
  // Validation selon le kind
  if (output.kind === 'image' && !Array.isArray(output.images)) return false;
  if (output.kind === 'carousel' && !Array.isArray(output.slides)) return false;
  if ((output.kind === 'video_standard' || output.kind === 'video_premium') && !output.video) return false;
  
  return true;
}
