/**
 * JobSpecV1 - Schéma unifié pour tous les types de jobs
 * Utilisé par Studio, ChatWidget, et l'API backend
 */
import { z } from 'zod';

// Types de deliverables possibles
export const DeliverableType = z.enum([
  'master_9x16',
  'variant_1x1',
  'variant_16x9',
  'variant_4x5',
  'thumb_1',
  'thumb_2',
  'thumb_3',
  'cover',
  'zip',
  'srt',
  'csv',
]);

// Types de jobs
export const JobKind = z.enum([
  'single_image',
  'multi_image',
  'carousel',
  'multi_clip_video',
  'campaign_pack',
]);

// Beat/Scène pour vidéos multi-clips
export const VideoBeat = z.object({
  sceneIndex: z.number(),
  visualPrompt: z.string(),
  voiceoverText: z.string().optional(),
  durationSec: z.number().default(8),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).optional(),
});

// Slide pour carousels
export const CarouselSlide = z.object({
  slideIndex: z.number(),
  titleOnImage: z.string().max(50),
  subtitle: z.string().max(30).optional(),
  textOnImage: z.string().max(150),
  caption: z.string(),
  bullets: z.array(z.string()).optional(),
  author: z.string().optional(),
  visualPrompt: z.string().optional(),
});

// Locks et contraintes visuelles
export const VisualLocks = z.object({
  palette_lock: z.boolean().default(true),
  light_mode: z.boolean().default(false),
  safe_zone: z.boolean().default(false),
  negative_prompts: z.array(z.string()).optional(),
  identity_lock: z.boolean().default(true),
  face_lock: z.boolean().default(false),
  outfit_lock: z.boolean().default(false),
  camera_angle_lock: z.boolean().default(false),
}).partial();

// Configuration audio
export const AudioConfig = z.object({
  voiceover_enabled: z.boolean().default(true),
  voice_id: z.string().optional(),
  language: z.string().default('fr'),
  music_enabled: z.boolean().default(true),
  music_prompt: z.string().optional(),
  music_volume_db: z.number().default(-20),
  sfx_enabled: z.boolean().default(false),
  ducking_enabled: z.boolean().default(true),
  voice_lufs_target: z.number().default(-16),
}).partial();

// Configuration rendu
export const RenderConfig = z.object({
  fps: z.number().default(30),
  codec: z.enum(['h264', 'h265', 'vp9']).default('h264'),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  thumbnails_timestamps: z.array(z.number()).optional(),
  video_model: z.string().default('veo_3_1'),
  image_model: z.string().default('imagen_3'),
}).partial();

// Schéma principal JobSpecV1
export const JobSpecV1 = z.object({
  version: z.literal('v1').default('v1'),
  kind: JobKind,

  // Identité de marque
  brandkit_id: z.string().uuid(),
  template_id: z.string().optional(),
  character_anchor_id: z.string().uuid().optional(),

  // Format master
  ratio_master: z.enum(['9:16', '1:1', '16:9', '4:5']).default('9:16'),

  // Pour vidéos
  duration_total: z.number().optional(),
  clip_count: z.number().optional(),
  script: z.string().optional(), // Script complet pour plan_script
  beats: z.array(VideoBeat).optional(), // Beats prédéfinis

  // Pour images
  prompts: z.array(z.string()).optional(), // Prompts individuels
  image_count: z.number().optional(),
  visual_style: z.string().default('photorealistic'),

  // Pour carousels
  slides: z.array(CarouselSlide).optional(),
  slides_count: z.number().optional(),
  carousel_theme: z.string().optional(),

  // Deliverables demandés
  deliverables: z.array(DeliverableType).default(['master_9x16']),

  // Options avancées
  locks: VisualLocks.optional(),
  audio: AudioConfig.optional(),
  render: RenderConfig.optional(),

  // Métadonnées
  campaign_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type JobSpecV1Type = z.infer<typeof JobSpecV1>;
export type JobKindType = z.infer<typeof JobKind>;
export type DeliverableTypeValue = z.infer<typeof DeliverableType>;
export type VideoBeatType = z.infer<typeof VideoBeat>;
export type CarouselSlideType = z.infer<typeof CarouselSlide>;

// Helper pour déterminer les step types selon le kind
export function getStepTypesForKind(kind: JobKindType): string[] {
  switch (kind) {
    case 'single_image':
      return ['gen_image', 'deliver'];
    
    case 'multi_image':
      return ['gen_image', 'deliver']; // gen_image sera dupliqué par image_count
    
    case 'carousel':
      return ['plan_slides', 'gen_slide', 'assemble_carousel', 'deliver'];
    
    case 'multi_clip_video':
      return [
        'plan_script',
        'gen_keyframe',
        'animate_clip',
        'voiceover',
        'music',
        'concat_clips',
        'mix_audio',
        'deliver',
      ];
    
    case 'campaign_pack':
      return [
        'plan_assets',
        'gen_keyframe',
        'animate_clip',
        'voiceover',
        'music',
        'concat_clips',
        'mix_audio',
        'render_variant',
        'extract_thumbnails',
        'render_cover',
        'deliver',
      ];
    
    default:
      return ['deliver'];
  }
}

// Helper pour calculer le coût en Woofs
export function calculateWoofsCost(spec: JobSpecV1Type): number {
  let cost = 0;

  switch (spec.kind) {
    case 'single_image':
      cost = 1;
      break;
    case 'multi_image':
      cost = spec.image_count || spec.prompts?.length || 1;
      break;
    case 'carousel':
      cost = Math.ceil((spec.slides_count || spec.slides?.length || 5) / 2);
      break;
    case 'multi_clip_video':
      const clipCount = spec.clip_count || spec.beats?.length || 1;
      const durationPerClip = spec.beats?.[0]?.durationSec || 8;
      // 1 woof pour ≤8s, 2 pour ≤15s, 4 pour ≤30s, 8 pour ≤60s
      const woofPerClip = durationPerClip <= 8 ? 1 : durationPerClip <= 15 ? 2 : durationPerClip <= 30 ? 4 : 8;
      cost = clipCount * woofPerClip;
      if (spec.audio?.voiceover_enabled) cost += 1;
      if (spec.audio?.music_enabled) cost += 1;
      break;
    case 'campaign_pack':
      // Base vidéo
      cost = calculateWoofsCost({ ...spec, kind: 'multi_clip_video' });
      // + variants
      const variantCount = spec.deliverables.filter(d => d.startsWith('variant_')).length;
      cost += variantCount;
      // + thumbs
      const thumbCount = spec.deliverables.filter(d => d.startsWith('thumb_')).length;
      cost += Math.ceil(thumbCount / 3);
      break;
  }

  return Math.max(1, cost);
}
