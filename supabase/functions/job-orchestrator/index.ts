/**
 * job-orchestrator - Edge Function unifiée pour créer des jobs
 * Remplace video-pipeline-orchestrator et la logique d'insertion directe
 * 
 * POST /functions/v1/job-orchestrator
 * Body: { spec: JobSpecV1 }
 * 
 * Retourne: { jobId, steps, woofsCost }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 500) {
  console.error(`[job-orchestrator] Error: ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// =====================================================
// JobSpecV1 Schema (Zod for Deno)
// =====================================================

const DeliverableType = z.enum([
  'master_9x16', 'variant_1x1', 'variant_16x9', 'variant_4x5',
  'thumb_1', 'thumb_2', 'thumb_3', 'cover', 'zip', 'srt', 'csv',
]);

const JobKind = z.enum([
  'single_image', 'multi_image', 'carousel', 'multi_clip_video', 'campaign_pack',
]);

const VideoBeat = z.object({
  sceneIndex: z.number(),
  visualPrompt: z.string(),
  voiceoverText: z.string().optional(),
  durationSec: z.number().default(8),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).optional(),
});

const CarouselSlide = z.object({
  slideIndex: z.number(),
  titleOnImage: z.string(),
  subtitle: z.string().optional(),
  textOnImage: z.string(),
  caption: z.string(),
  bullets: z.array(z.string()).optional(),
  author: z.string().optional(),
  visualPrompt: z.string().optional(),
});

const VisualLocks = z.object({
  palette_lock: z.boolean().default(true),
  light_mode: z.boolean().default(false),
  safe_zone: z.boolean().default(false),
  negative_prompts: z.array(z.string()).optional(),
  identity_lock: z.boolean().default(true),
  face_lock: z.boolean().default(false),
  outfit_lock: z.boolean().default(false),
  camera_angle_lock: z.boolean().default(false),
}).partial();

const AudioConfig = z.object({
  voiceover_enabled: z.boolean().default(true),
  voice_id: z.string().optional(),
  language: z.string().default('fr'),
  music_enabled: z.boolean().default(true),
  music_prompt: z.string().optional(),
  music_volume_db: z.number().default(-20),
  sfx_enabled: z.boolean().default(false),
  ducking_enabled: z.boolean().default(true),
  voice_lufs_target: z.number().default(-16),
  lip_sync_enabled: z.boolean().default(false),
}).partial();

const RenderConfig = z.object({
  fps: z.number().default(30),
  codec: z.enum(['h264', 'h265', 'vp9']).default('h264'),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  thumbnails_timestamps: z.array(z.number()).optional(),
  video_model: z.string().default('veo_3_1'),
  image_model: z.string().default('imagen_3'),
}).partial();

const JobSpecV1 = z.object({
  version: z.literal('v1').default('v1'),
  kind: JobKind,
  brandkit_id: z.string().uuid(),
  template_id: z.string().optional(),
  character_anchor_id: z.string().uuid().optional(),
  subject_pack_id: z.string().uuid().optional(), // NEW: Subject Pack
  ratio_master: z.enum(['9:16', '1:1', '16:9', '4:5']).default('9:16'),
  duration_total: z.number().optional(),
  clip_count: z.number().optional(),
  script: z.string().optional(),
  beats: z.array(VideoBeat).optional(),
  prompts: z.array(z.string()).optional(),
  image_count: z.number().optional(),
  visual_style: z.string().default('photorealistic'),
  slides: z.array(CarouselSlide).optional(),
  slides_count: z.number().optional(),
  carousel_theme: z.string().optional(),
  deliverables: z.array(DeliverableType).default(['master_9x16']),
  locks: VisualLocks.optional(),
  audio: AudioConfig.optional(),
  render: RenderConfig.optional(),
  campaign_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  use_brand_kit: z.boolean().default(true),  // Brand Kit toggle
});

type JobSpecV1Type = z.infer<typeof JobSpecV1>;
type JobKindType = z.infer<typeof JobKind>;

// =====================================================
// STEP GENERATION LOGIC
// =====================================================

interface StepInput {
  step_type: string;
  step_index: number;
  input_json: Record<string, unknown>;
}

function generateStepsForSingleImage(spec: JobSpecV1Type): StepInput[] {
  return [
    {
      step_type: 'gen_image',
      step_index: 0,
      input_json: {
        prompt: spec.prompts?.[0] || '',
        ratio: spec.ratio_master,
        visualStyle: spec.visual_style,
        identityAnchorId: spec.character_anchor_id,
        subjectPackId: spec.subject_pack_id, // ✅ Propagate Subject Pack
        locks: spec.locks,
      },
    },
    {
      step_type: 'deliver',
      step_index: 1,
      input_json: { deliverables: spec.deliverables },
    },
  ];
}

function generateStepsForMultiImage(spec: JobSpecV1Type): StepInput[] {
  const steps: StepInput[] = [];
  const count = spec.image_count || spec.prompts?.length || 1;
  
  for (let i = 0; i < count; i++) {
    steps.push({
      step_type: 'gen_image',
      step_index: i,
      input_json: {
        imageIndex: i,
        prompt: spec.prompts?.[i] || spec.prompts?.[0] || '',
        ratio: spec.ratio_master,
        visualStyle: spec.visual_style,
        identityAnchorId: spec.character_anchor_id,
        subjectPackId: spec.subject_pack_id, // ✅ Propagate Subject Pack
        locks: spec.locks,
      },
    });
  }
  
  steps.push({
    step_type: 'deliver',
    step_index: count,
    input_json: { deliverables: spec.deliverables, imageCount: count },
  });
  
  return steps;
}

function generateStepsForCarousel(spec: JobSpecV1Type): StepInput[] {
  const steps: StepInput[] = [];
  const slideCount = spec.slides_count || spec.slides?.length || 5;
  let stepIndex = 0;

  // Plan slides if not provided
  if (!spec.slides || spec.slides.length === 0) {
    steps.push({
      step_type: 'plan_slides',
      step_index: stepIndex++,
      input_json: {
        theme: spec.carousel_theme,
        slideCount,
        ratio: spec.ratio_master,
      },
    });
  }

  // Generate each slide
  for (let i = 0; i < slideCount; i++) {
    steps.push({
      step_type: 'gen_slide',
      step_index: stepIndex++,
      input_json: {
        slideIndex: i,
        slide: spec.slides?.[i],
        ratio: spec.ratio_master,
        visualStyle: spec.visual_style,
        identityAnchorId: spec.character_anchor_id,
        subjectPackId: spec.subject_pack_id, // ✅ Propagate Subject Pack
      },
    });
  }

  // Assemble carousel
  steps.push({
    step_type: 'assemble_carousel',
    step_index: stepIndex++,
    input_json: { slideCount },
  });

  // Deliver
  steps.push({
    step_type: 'deliver',
    step_index: stepIndex,
    input_json: { deliverables: spec.deliverables },
  });

  return steps;
}

function generateStepsForMultiClipVideo(spec: JobSpecV1Type): StepInput[] {
  const steps: StepInput[] = [];
  const clipCount = spec.clip_count || spec.beats?.length || 3;
  let stepIndex = 0;

  // Plan script if not provided
  if (!spec.beats || spec.beats.length === 0) {
    steps.push({
      step_type: 'plan_script',
      step_index: stepIndex++,
      input_json: {
        script: spec.script,
        clipCount,
        durationTotal: spec.duration_total,
      },
    });
  }

  // Generate keyframes
  for (let i = 0; i < clipCount; i++) {
    steps.push({
      step_type: 'gen_keyframe',
      step_index: stepIndex++,
      input_json: {
        sceneIndex: i,
        visualPrompt: spec.beats?.[i]?.visualPrompt || '',
        ratio: spec.ratio_master,
        identityAnchorId: spec.character_anchor_id,
        subjectPackId: spec.subject_pack_id, // ✅ Propagate Subject Pack
        locks: spec.locks,
        useLipSync: spec.audio?.lip_sync_enabled || false,
      },
    });
  }

  // Animate clips
  for (let i = 0; i < clipCount; i++) {
    steps.push({
      step_type: 'animate_clip',
      step_index: stepIndex++,
      input_json: {
        sceneIndex: i,
        visualPrompt: spec.beats?.[i]?.visualPrompt || '',
        durationSeconds: spec.beats?.[i]?.durationSec || 8,
        ratio: spec.ratio_master,
        identityAnchorId: spec.character_anchor_id,
        subjectPackId: spec.subject_pack_id, // ✅ Propagate Subject Pack
        useLipSync: spec.audio?.lip_sync_enabled || false,
      },
    });
  }

  // Voiceover
  if (spec.audio?.voiceover_enabled !== false) {
    const voiceoverText = spec.beats?.map(b => b.voiceoverText).filter(Boolean).join(' ') || '';
    if (voiceoverText) {
      steps.push({
        step_type: 'voiceover',
        step_index: stepIndex++,
        input_json: {
          text: voiceoverText,
          voiceId: spec.audio?.voice_id,
          language: spec.audio?.language || 'fr',
        },
      });
    }
  }

  // Music
  if (spec.audio?.music_enabled !== false) {
    steps.push({
      step_type: 'music',
      step_index: stepIndex++,
      input_json: {
        prompt: spec.audio?.music_prompt,
        durationSeconds: spec.duration_total || clipCount * 8,
      },
    });
  }

  // Concat clips
  if (clipCount > 1) {
    steps.push({
      step_type: 'concat_clips',
      step_index: stepIndex++,
      input_json: { clipCount },
    });
  }

  // Mix audio
  steps.push({
    step_type: 'mix_audio',
    step_index: stepIndex++,
    input_json: {
      musicVolume: spec.audio?.music_volume_db || -20,
      voiceVolume: 100,
      duckingEnabled: spec.audio?.ducking_enabled ?? true,
    },
  });

  // Deliver
  steps.push({
    step_type: 'deliver',
    step_index: stepIndex,
    input_json: { deliverables: spec.deliverables },
  });

  return steps;
}

function generateStepsForCampaignPack(spec: JobSpecV1Type): StepInput[] {
  const steps = generateStepsForMultiClipVideo(spec);
  let stepIndex = steps.length;

  // Remove deliver step, we'll add it at the end
  const deliverStep = steps.pop()!;

  // Render variants
  const variants = spec.deliverables.filter(d => d.startsWith('variant_'));
  for (const variant of variants) {
    const ratio = variant.replace('variant_', '').replace('_', ':');
    steps.push({
      step_type: 'render_variant',
      step_index: stepIndex++,
      input_json: { targetRatio: ratio, variant },
    });
  }

  // Extract thumbnails
  const thumbs = spec.deliverables.filter(d => d.startsWith('thumb_'));
  if (thumbs.length > 0) {
    steps.push({
      step_type: 'extract_thumbnails',
      step_index: stepIndex++,
      input_json: {
        timestamps: spec.render?.thumbnails_timestamps || [1.0, 7.0, 15.0],
        count: thumbs.length,
      },
    });
  }

  // Render cover
  if (spec.deliverables.includes('cover')) {
    steps.push({
      step_type: 'render_cover',
      step_index: stepIndex++,
      input_json: { campaignName: spec.campaign_name },
    });
  }

  // Add back deliver step
  deliverStep.step_index = stepIndex;
  steps.push(deliverStep);

  return steps;
}

function generateSteps(spec: JobSpecV1Type): StepInput[] {
  switch (spec.kind) {
    case 'single_image':
      return generateStepsForSingleImage(spec);
    case 'multi_image':
      return generateStepsForMultiImage(spec);
    case 'carousel':
      return generateStepsForCarousel(spec);
    case 'multi_clip_video':
      return generateStepsForMultiClipVideo(spec);
    case 'campaign_pack':
      return generateStepsForCampaignPack(spec);
    default:
      throw new Error(`Unknown job kind: ${spec.kind}`);
  }
}

// =====================================================
// WOOFS COST CALCULATION
// =====================================================

function calculateWoofsCost(spec: JobSpecV1Type): number {
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
    case 'multi_clip_video': {
      const clipCount = spec.clip_count || spec.beats?.length || 1;
      const durationPerClip = spec.beats?.[0]?.durationSec || 8;
      const woofPerClip = durationPerClip <= 8 ? 1 : durationPerClip <= 15 ? 2 : durationPerClip <= 30 ? 4 : 8;
      cost = clipCount * woofPerClip;
      if (spec.audio?.voiceover_enabled !== false) cost += 1;
      if (spec.audio?.music_enabled !== false) cost += 1;
      break;
    }
    case 'campaign_pack': {
      cost = calculateWoofsCost({ ...spec, kind: 'multi_clip_video' });
      const variantCount = spec.deliverables.filter(d => d.startsWith('variant_')).length;
      cost += variantCount;
      const thumbCount = spec.deliverables.filter(d => d.startsWith('thumb_')).length;
      cost += Math.ceil(thumbCount / 3);
      break;
    }
  }

  return Math.max(1, cost);
}

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return err('Missing authorization header', 401);
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return err('Unauthorized', 401);
    }

    const body = await req.json();
    console.log('[job-orchestrator] Received spec:', JSON.stringify(body.spec, null, 2));

    // Validate spec
    const parseResult = JobSpecV1.safeParse(body.spec);
    if (!parseResult.success) {
      console.error('[job-orchestrator] Validation failed:', parseResult.error.errors);
      return err(`Invalid JobSpec: ${parseResult.error.errors.map(e => e.message).join(', ')}`, 400);
    }

    const spec = parseResult.data;
    const woofsCost = calculateWoofsCost(spec);

    console.log(`[job-orchestrator] Creating ${spec.kind} job for user ${user.id}, cost: ${woofsCost} woofs`);

    // Check quota via woofs-check-consume (internal call with secret)
    const INTERNAL_FN_SECRET = Deno.env.get('INTERNAL_FN_SECRET');
    
    const { data: quotaCheck, error: quotaError } = await supabaseAdmin.functions.invoke('woofs-check-consume', {
      headers: {
        'x-internal-secret': INTERNAL_FN_SECRET || '',
      },
      body: {
        userId: user.id,
        brand_id: spec.brandkit_id,
        cost_woofs: woofsCost,
        reason: `job_${spec.kind}`,
        metadata: {
          jobKind: spec.kind,
          campaignName: spec.campaign_name,
        },
      },
    });

    if (quotaError) {
      console.error('[job-orchestrator] Quota check failed:', quotaError);
      return err('Failed to check quota', 500);
    }

    // Check response content
    if (quotaCheck && !quotaCheck.ok) {
      const errorCode = quotaCheck.error?.code || 'UNKNOWN';
      const errorMsg = quotaCheck.error?.message || 'Quota check failed';
      console.error(`[job-orchestrator] Quota denied: ${errorCode} - ${errorMsg}`);
      
      if (errorCode === 'INSUFFICIENT_WOOFS') {
        return err(`Woofs insuffisants: ${quotaCheck.error.remaining} restants, ${woofsCost} requis`, 402);
      }
      return err(errorMsg, 403);
    }

    // Create the job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('job_queue')
      .insert({
        user_id: user.id,
        brand_id: spec.brandkit_id,
        type: spec.kind, // Use kind as type for compatibility
        kind: spec.kind,
        template_id: spec.template_id,
        brandkit_id: spec.brandkit_id,
        character_anchor_id: spec.character_anchor_id,
        spec_json: spec,
        payload: spec, // Legacy compatibility
        status: 'queued',
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('[job-orchestrator] Failed to create job:', jobError);
      // Refund woofs
      await supabaseAdmin.functions.invoke('alfie-refund-woofs', {
        body: { userId: user.id, brandId: spec.brandkit_id, woofsAmount: woofsCost },
      });
      return err(`Failed to create job: ${jobError.message}`, 500);
    }

    console.log(`[job-orchestrator] Created job ${job.id}`);

    // Generate steps
    const stepInputs = generateSteps(spec);
    
    // Insert steps
    const stepsToInsert = stepInputs.map((step, index) => ({
      job_id: job.id,
      step_type: step.step_type,
      step_index: step.step_index,
      input_json: {
        ...step.input_json,
        jobId: job.id,
        userId: user.id,
        brandId: spec.brandkit_id,
        useBrandKit: spec.use_brand_kit,  // Propager le flag Brand Kit
      },
      status: index === 0 ? 'queued' : 'pending', // First step is queued
      attempt: 0,
      max_attempts: 3,
    }));

    const { data: insertedSteps, error: stepsError } = await supabaseAdmin
      .from('job_steps')
      .insert(stepsToInsert)
      .select('id, step_type, step_index, status');

    if (stepsError) {
      console.error('[job-orchestrator] Failed to create steps:', stepsError);
      // Mark job as failed
      await supabaseAdmin
        .from('job_queue')
        .update({ status: 'failed', error: 'Failed to create steps' })
        .eq('id', job.id);
      // Refund woofs
      await supabaseAdmin.functions.invoke('alfie-refund-woofs', {
        body: { userId: user.id, brandId: spec.brandkit_id, woofsAmount: woofsCost },
      });
      return err(`Failed to create steps: ${stepsError.message}`, 500);
    }

    console.log(`[job-orchestrator] Created ${insertedSteps?.length} steps for job ${job.id}`);

    // Emit job_created event
    await supabaseAdmin.from('job_events').insert({
      job_id: job.id,
      event_type: 'job_created',
      message: `Created ${spec.kind} job with ${insertedSteps?.length} steps`,
      metadata: { kind: spec.kind, woofsCost, stepCount: insertedSteps?.length },
    });

    // Trigger the step runner (fire and forget)
    fetch(`${SUPABASE_URL}/functions/v1/video-step-runner`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => {});

    return ok({
      jobId: job.id,
      kind: spec.kind,
      steps: insertedSteps,
      woofsCost,
      message: `Job created successfully with ${insertedSteps?.length} steps`,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[job-orchestrator] Fatal error:', errorMessage);
    return err(errorMessage);
  }
});
