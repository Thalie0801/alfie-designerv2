import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const INTERNAL_FN_SECRET = Deno.env.get('INTERNAL_FN_SECRET') ?? '';

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
  console.error(`[video-step-runner] Error: ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// =====================================================
// COLLECT OUTPUTS FROM PREVIOUS STEPS
// =====================================================

async function getStepOutputs(jobId: string): Promise<Record<string, unknown>> {
  const { data: previousSteps } = await supabaseAdmin
    .from('job_steps')
    .select('step_type, step_index, output_json')
    .eq('job_id', jobId)
    .eq('status', 'completed')
    .order('step_index', { ascending: true });

  const outputs: Record<string, unknown> = {
    keyframes: [] as string[],
    clipUrls: [] as string[],
  };

  for (const step of previousSteps || []) {
    const output = step.output_json as Record<string, unknown> | null;
    if (!output) continue;

    // Collect keyframes
    if (step.step_type === 'gen_keyframe' && output.keyframeUrl) {
      (outputs.keyframes as string[]).push(output.keyframeUrl as string);
    }
    // Collect animated clips
    if (step.step_type === 'animate_clip' && output.clipUrl) {
      (outputs.clipUrls as string[]).push(output.clipUrl as string);
    }
    // Collect voiceover
    if (step.step_type === 'voiceover') {
      outputs.voiceoverUrl = output.voiceoverUrl;
    }
    // Collect music
    if (step.step_type === 'music') {
      outputs.musicUrl = output.musicUrl;
    }
    // Collect concatenated video
    if (step.step_type === 'concat_clips') {
      outputs.finalVideoUrl = output.finalVideoUrl;
    }
    // Collect mixed video
    if (step.step_type === 'mix_audio') {
      outputs.mixedVideoUrl = output.mixedVideoUrl;
    }
  }

  return outputs;
}

function enrichInputWithPreviousOutputs(
  stepType: string,
  input: Record<string, unknown>,
  previousOutputs: Record<string, unknown>
): Record<string, unknown> {
  const enriched = { ...input };

  // For animate_clip: inject corresponding keyframe
  if (stepType === 'animate_clip') {
    const sceneIndex = (input.sceneIndex as number) ?? 0;
    const keyframes = previousOutputs.keyframes as string[];
    if (keyframes && keyframes[sceneIndex]) {
      enriched.keyframeUrl = keyframes[sceneIndex];
    }
  }

  // For concat_clips: inject all clip URLs
  if (stepType === 'concat_clips') {
    const clipUrls = previousOutputs.clipUrls as string[];
    if (clipUrls && clipUrls.length > 0) {
      enriched.clipUrls = clipUrls;
    }
  }

  // For mix_audio: inject video + voiceover + music
  if (stepType === 'mix_audio') {
    if (previousOutputs.finalVideoUrl) {
      enriched.videoUrl = previousOutputs.finalVideoUrl;
    } else if ((previousOutputs.clipUrls as string[])?.length > 0) {
      enriched.videoUrl = (previousOutputs.clipUrls as string[])[0];
    }
    if (previousOutputs.voiceoverUrl) {
      enriched.voiceoverUrl = previousOutputs.voiceoverUrl;
    }
    if (previousOutputs.musicUrl) {
      enriched.musicUrl = previousOutputs.musicUrl;
    }
  }

  // For deliver: inject mixed or final video
  if (stepType === 'deliver') {
    if (previousOutputs.mixedVideoUrl) {
      enriched.finalVideoUrl = previousOutputs.mixedVideoUrl;
    } else if (previousOutputs.finalVideoUrl) {
      enriched.finalVideoUrl = previousOutputs.finalVideoUrl;
    } else if ((previousOutputs.clipUrls as string[])?.length > 0) {
      enriched.finalVideoUrl = (previousOutputs.clipUrls as string[])[0];
    }
  }

  return enriched;
}

// =====================================================
// STEP HANDLERS
// =====================================================

// Helper: Charger le Brand Kit depuis la DB
async function loadBrandKit(brandId: string): Promise<Record<string, unknown> | null> {
  if (!brandId) return null;
  
  const { data, error } = await supabaseAdmin
    .from('brands')
    .select('id, name, palette, logo_url, fonts, voice, niche, pitch, adjectives, tagline, tone_sliders, person, language_level, visual_types, visual_mood, avoid_in_visuals, text_color')
    .eq('id', brandId)
    .single();
  
  if (error || !data) {
    console.warn(`[video-step-runner] Could not load brandKit for ${brandId}:`, error?.message);
    return null;
  }
  
  return data;
}

async function handleGenKeyframe(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { visualPrompt, identityAnchorId, ratio, userId, brandId, useBrandKit } = input;
  
  console.log(`[gen_keyframe] userId: ${userId}, brandId: ${brandId}, useBrandKit: ${useBrandKit}`);
  console.log(`[gen_keyframe] Generating keyframe with prompt: ${String(visualPrompt).substring(0, 100)}...`);
  
  // Charger le Brand Kit si activé
  let brandKit: Record<string, unknown> | null = null;
  if (useBrandKit !== false && brandId) {
    brandKit = await loadBrandKit(String(brandId));
    console.log(`[gen_keyframe] Loaded brandKit: ${brandKit?.name || 'none'}`);
  }
  
  // Récupérer l'anchor si défini
  let anchorConstraints = '';
  let refImageUrl: string | null = null;
  
  if (identityAnchorId) {
    const { data: anchor } = await supabaseAdmin
      .from('identity_anchors')
      .select('*')
      .eq('id', identityAnchorId)
      .single();
    
    if (anchor) {
      refImageUrl = anchor.ref_image_url;
      const constraints = anchor.constraints_json as Record<string, boolean> | null;
      if (constraints?.face_lock) anchorConstraints += 'MAINTAIN EXACT face shape, eye color, hair style. ';
      if (constraints?.outfit_lock) anchorConstraints += 'MAINTAIN EXACT outfit and clothing colors. ';
      if (constraints?.palette_lock) anchorConstraints += 'MAINTAIN color palette consistency. ';
    }
  }

  // Prompt pour générer l'image keyframe
  const imagePrompt = `${visualPrompt}

${anchorConstraints ? `IDENTITY LOCK:\n${anchorConstraints}` : ''}

CRITICAL: Generate a single, clean image suitable as a video keyframe. No text, no split screens.
Aspect ratio: ${ratio || '9:16'}`;

  // Appeler alfie-generate-ai-image avec le header X-Internal-Secret
  const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-generate-ai-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_FN_SECRET,
    },
    body: JSON.stringify({
      userId,
      brandId,
      brandKit,          // Passer le Brand Kit complet
      useBrandKit,       // Flag pour activer l'enrichissement
      prompt: imagePrompt,
      ratio: ratio || '9:16',
      referenceImageUrl: refImageUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[gen_keyframe] Generated keyframe: ${result.imageUrl}`);

  return {
    keyframeUrl: result.imageUrl,
    prompt: imagePrompt,
  };
}

async function handleAnimateClip(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { keyframeUrl, visualPrompt, identityAnchorId, ratio, durationSeconds, sceneIndex, userId, brandId } = input;
  
  console.log(`[animate_clip] Animating scene ${sceneIndex} with VEO 3.1`);
  console.log(`[animate_clip] userId: ${userId}, brandId: ${brandId}`);
  console.log(`[animate_clip] keyframe: ${keyframeUrl}`);

  if (!keyframeUrl) {
    throw new Error('Missing keyframeUrl for animate_clip step');
  }

  if (!userId) {
    throw new Error('Missing userId for animate_clip step');
  }

  // Récupérer les contraintes de l'anchor
  let anchorPrompt = '';
  if (identityAnchorId) {
    const { data: anchor } = await supabaseAdmin
      .from('identity_anchors')
      .select('constraints_json')
      .eq('id', identityAnchorId)
      .single();
    
    if (anchor?.constraints_json) {
      const constraints = anchor.constraints_json as Record<string, boolean>;
      if (constraints.face_lock) anchorPrompt += 'MAINTAIN character identity throughout. ';
      if (constraints.camera_angle) anchorPrompt += 'Keep consistent camera angle. ';
    }
  }

  // Enrichir le prompt pour VEO
  const enrichedPrompt = `${visualPrompt}

${anchorPrompt}

CRITICAL FRAME RULES:
- ONE SINGLE FULL-FRAME SHOT
- NO split screen, NO collage, NO multiple panels
- Character must remain IDENTICAL throughout the clip
- Smooth, cinematic motion`;

  // Appeler generate-video avec provider veo3 (endpoint correct)
  const veoPayload = {
    userId,
    brandId,
    prompt: enrichedPrompt,
    referenceImageUrl: keyframeUrl,
    aspectRatio: ratio || '9:16',
    provider: 'veo3',
    withAudio: false,
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_FN_SECRET,
    },
    body: JSON.stringify(veoPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`VEO generation failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[animate_clip] Generated clip: ${result.videoUrl}`);

  return {
    clipUrl: result.videoUrl,
    durationSeconds: durationSeconds || 8,
    sceneIndex,
  };
}

async function handleVoiceover(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { text, voiceId, language } = input;
  
  console.log(`[voiceover] Generating voiceover for ${String(text).length} characters`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceId: voiceId || 'pFZP5JQG7iQjIQuC4Bku', // Lily FR par défaut
      language: language || 'fr',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voiceover generation failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[voiceover] Generated voiceover: ${result.audioUrl}`);

  return {
    voiceoverUrl: result.audioUrl,
    durationSeconds: result.durationSeconds,
  };
}

async function handleMusic(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { prompt, durationSeconds } = input;
  
  console.log(`[music] Generating background music`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-music`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt || 'Upbeat corporate background music, modern and professional',
      durationSeconds: durationSeconds || 30,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Music generation failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[music] Generated music: ${result.audioUrl}`);

  return {
    musicUrl: result.audioUrl,
    durationSeconds: result.durationSeconds,
  };
}

async function handleMixAudio(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { videoUrl, voiceoverUrl, musicUrl, voiceVolume, musicVolume, originalVideoVolume } = input;
  
  console.log(`[mix_audio] Mixing audio tracks for video: ${videoUrl}`);

  if (!videoUrl) {
    throw new Error('Missing videoUrl for mix_audio step');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/mix-audio-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoUrl,
      voiceoverUrl,
      musicUrl,
      voiceVolume: voiceVolume ?? 100,
      musicVolume: musicVolume ?? 15,
      originalVideoVolume: originalVideoVolume ?? 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audio mixing failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[mix_audio] Mixed video: ${result.mixedVideoUrl}`);

  return {
    mixedVideoUrl: result.mixedVideoUrl,
    audioMixHash: result.audioMixHash,
  };
}

async function handleConcatClips(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { clipUrls } = input as { clipUrls: string[] };
  
  console.log(`[concat_clips] Concatenating ${clipUrls?.length || 0} clips`);

  if (!clipUrls || clipUrls.length === 0) {
    throw new Error('No clip URLs provided for concatenation');
  }

  if (clipUrls.length === 1) {
    return { finalVideoUrl: clipUrls[0] };
  }

  // Pour la concatenation, on utilise l'API Cloudinary
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  
  // Extraire les public_ids des URLs
  const publicIds = clipUrls.map(url => {
    const match = url.match(/\/video\/upload\/[^/]+\/(.+)\.(mp4|webm)/);
    return match ? match[1] : url;
  });

  // Construire l'URL de concatenation
  const concatTransform = publicIds.slice(1).map(id => `l_video:${id.replace(/\//g, ':')},fl_splice,du_8/`).join('');
  const firstPublicId = publicIds[0];
  
  const concatenatedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${concatTransform}${firstPublicId}.mp4`;
  
  console.log(`[concat_clips] Concatenated video: ${concatenatedUrl}`);

  return {
    finalVideoUrl: concatenatedUrl,
    clipCount: clipUrls.length,
  };
}

async function handleDeliver(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { finalVideoUrl, jobId, userId, brandId } = input;
  
  console.log(`[deliver] Delivering final video for job ${jobId}: ${finalVideoUrl}`);

  if (!finalVideoUrl) {
    throw new Error('No final video URL to deliver');
  }

  // Sauvegarder dans media_generations
  const { data: media, error: mediaError } = await supabaseAdmin
    .from('media_generations')
    .insert({
      user_id: userId,
      brand_id: brandId,
      type: 'video_pipeline',
      output_url: finalVideoUrl,
      status: 'completed',
      modality: 'video',
      engine: 'veo_3_1',
    })
    .select('id')
    .single();

  if (mediaError) {
    throw new Error(`Failed to save media: ${mediaError.message}`);
  }

  console.log(`[deliver] Saved to media_generations: ${media.id}`);

  return {
    mediaGenerationId: media.id,
    deliveredUrl: finalVideoUrl,
    deliveredAt: new Date().toISOString(),
  };
}

// =====================================================
// STEP ROUTER (Unified for all job types)
// =====================================================

async function executeStep(stepType: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (stepType) {
    // Video pipeline steps
    case 'gen_keyframe':
      return handleGenKeyframe(input);
    case 'animate_clip':
      return handleAnimateClip(input);
    case 'voiceover':
      return handleVoiceover(input);
    case 'music':
      return handleMusic(input);
    case 'mix_audio':
      return handleMixAudio(input);
    case 'concat_clips':
      return handleConcatClips(input);
    case 'deliver':
      return handleDeliver(input);
    
    // Image pipeline steps
    case 'gen_image':
      return handleGenImage(input);
    
    // Carousel pipeline steps
    case 'gen_slide':
      return handleGenSlide(input);
    case 'plan_slides':
      return handlePlanSlides(input);
    case 'assemble_carousel':
      return handleAssembleCarousel(input);
    
    // Campaign pack steps
    case 'render_variant':
      return handleRenderVariant(input);
    case 'extract_thumbnails':
      return handleExtractThumbnails(input);
    case 'render_cover':
      return handleRenderCover(input);
    
    // Script planning
    case 'plan_script':
      return handlePlanScript(input);
    case 'plan_assets':
      return handlePlanAssets(input);
    
    default:
      throw new Error(`Unknown step type: ${stepType}`);
  }
}

// =====================================================
// NEW STEP HANDLERS (for unified pipeline)
// =====================================================

async function handleGenImage(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { prompt, ratio, visualStyle, identityAnchorId, userId, brandId, useBrandKit } = input;
  
  console.log(`[gen_image] userId: ${userId}, brandId: ${brandId}, useBrandKit: ${useBrandKit}`);
  console.log(`[gen_image] Generating image with prompt: ${String(prompt).substring(0, 100)}...`);

  // Charger le Brand Kit si activé
  let brandKit: Record<string, unknown> | null = null;
  if (useBrandKit !== false && brandId) {
    brandKit = await loadBrandKit(String(brandId));
    console.log(`[gen_image] Loaded brandKit: ${brandKit?.name || 'none'}`);
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-generate-ai-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_FN_SECRET,
    },
    body: JSON.stringify({
      userId,
      brandId,
      brandKit,
      useBrandKit,
      prompt,
      ratio: ratio || '9:16',
      visualStyle: visualStyle || 'photorealistic',
      identityAnchorId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[gen_image] Generated image: ${result.imageUrl}`);

  return {
    imageUrl: result.imageUrl,
    imageIndex: input.imageIndex || 0,
  };
}

async function handleGenSlide(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { slideIndex, slide, ratio, visualStyle, userId, brandId, useBrandKit } = input;
  
  console.log(`[gen_slide] userId: ${userId}, brandId: ${brandId}, useBrandKit: ${useBrandKit}`);
  console.log(`[gen_slide] Generating slide ${slideIndex}`);

  // Charger le Brand Kit si activé
  let brandKit: Record<string, unknown> | null = null;
  if (useBrandKit !== false && brandId) {
    brandKit = await loadBrandKit(String(brandId));
    console.log(`[gen_slide] Loaded brandKit: ${brandKit?.name || 'none'}`);
  }

  const slideData = slide as Record<string, unknown> | undefined;
  const prompt = slideData?.visualPrompt || slideData?.titleOnImage || 'Professional slide background';

  const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-render-carousel-slide`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_FN_SECRET,
    },
    body: JSON.stringify({
      userId,
      brandId,
      brandKit,
      useBrandKit,
      prompt,
      slideIndex,
      slide: slideData,
      ratio: ratio || '9:16',
      visualStyle: visualStyle || 'photorealistic',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slide generation failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[gen_slide] Generated slide ${slideIndex}: ${result.slideUrl}`);

  return {
    slideUrl: result.slideUrl || result.imageUrl,
    slideIndex,
  };
}

async function handlePlanSlides(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { theme, slideCount } = input;
  
  console.log(`[plan_slides] Planning ${slideCount} slides for theme: ${theme}`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-plan-carousel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_FN_SECRET,
    },
    body: JSON.stringify({
      theme,
      slideCount: slideCount || 5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slide planning failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[plan_slides] Planned ${result.slides?.length || 0} slides`);

  return {
    slides: result.slides,
    slideCount: result.slides?.length || slideCount,
  };
}

async function handleAssembleCarousel(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  console.log(`[assemble_carousel] Assembling carousel`);
  
  // Collect slides from previous outputs
  // This will be enriched by enrichInputWithPreviousOutputs
  const slideUrls = input.slideUrls as string[] || [];
  
  return {
    carouselUrls: slideUrls,
    slideCount: slideUrls.length,
  };
}

async function handleRenderVariant(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { targetRatio, variant, videoUrl } = input;
  
  console.log(`[render_variant] Rendering ${variant} variant (${targetRatio})`);

  // For now, just pass through - ffmpeg worker will handle actual resizing
  return {
    variantUrl: videoUrl, // Placeholder - would be processed by ffmpeg
    variant,
    targetRatio,
  };
}

async function handleExtractThumbnails(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { timestamps, count, videoUrl } = input;
  
  console.log(`[extract_thumbnails] Extracting ${count} thumbnails at ${JSON.stringify(timestamps)}`);

  // For now, return placeholder - ffmpeg worker will handle actual extraction
  const thumbUrls = (timestamps as number[] || [1, 7, 15]).map((ts, i) => ({
    timestamp: ts,
    url: videoUrl, // Placeholder
    index: i,
  }));

  return {
    thumbnails: thumbUrls,
    count: thumbUrls.length,
  };
}

async function handleRenderCover(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { campaignName, videoUrl } = input;
  
  console.log(`[render_cover] Rendering cover for: ${campaignName}`);

  // For now, use first thumbnail as cover
  return {
    coverUrl: videoUrl, // Placeholder
    campaignName,
  };
}

async function handlePlanScript(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { script, clipCount, durationTotal } = input;
  
  console.log(`[plan_script] Planning script for ${clipCount} clips`);

  // Use LLM to break script into beats
  // For now, return simple split
  const lines = (script as string || '').split(/[.!?]+/).filter(l => l.trim());
  const beatsPerClip = Math.ceil(lines.length / (clipCount as number || 3));
  
  const beats = [];
  for (let i = 0; i < (clipCount as number || 3); i++) {
    const clipLines = lines.slice(i * beatsPerClip, (i + 1) * beatsPerClip);
    beats.push({
      sceneIndex: i,
      visualPrompt: clipLines.join('. ') || `Scene ${i + 1}`,
      voiceoverText: clipLines.join('. '),
      durationSec: Math.floor((durationTotal as number || 24) / (clipCount as number || 3)),
    });
  }

  return {
    beats,
    clipCount: beats.length,
  };
}

async function handlePlanAssets(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  console.log(`[plan_assets] Planning campaign assets`);
  
  // For campaign packs, reuse plan_script logic
  return handlePlanScript(input);
}

// =====================================================
// EMIT EVENT
// =====================================================

async function emitEvent(
  jobId: string,
  stepId: string | null,
  eventType: string,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  await supabaseAdmin.from('job_events').insert({
    job_id: jobId,
    step_id: stepId,
    event_type: eventType,
    message,
    metadata,
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[video-step-runner] Starting step processing...');

    // Claim le prochain step disponible
    const { data: steps, error: claimError } = await supabaseAdmin.rpc('claim_next_step');

    if (claimError) {
      console.error('[video-step-runner] Claim error:', claimError);
      return err(`Failed to claim step: ${claimError.message}`);
    }

    if (!steps || steps.length === 0) {
      console.log('[video-step-runner] No steps to process');
      return ok({ message: 'No steps to process' });
    }

    const step = steps[0];
    console.log(`[video-step-runner] Processing step ${step.step_id} (${step.step_type}) for job ${step.job_id}`);

    // Émettre événement de démarrage
    await emitEvent(step.job_id, step.step_id, 'step_started', `Started ${step.step_type}`);

    try {
      // Récupérer les outputs des steps précédents
      const previousOutputs = await getStepOutputs(step.job_id);
      console.log(`[video-step-runner] Previous outputs:`, JSON.stringify(previousOutputs, null, 2));

      // Enrichir l'input avec les outputs précédents
      const enrichedInput = enrichInputWithPreviousOutputs(
        step.step_type,
        step.input_json || {},
        previousOutputs
      );
      console.log(`[video-step-runner] Enriched input for ${step.step_type}:`, JSON.stringify(enrichedInput, null, 2));

      // Exécuter le step
      const output = await executeStep(step.step_type, enrichedInput);

      // Marquer comme completed et queue le suivant
      const { error: completeError } = await supabaseAdmin.rpc('complete_step_and_queue_next', {
        p_step_id: step.step_id,
        p_output_json: output,
      });

      if (completeError) {
        throw new Error(`Failed to complete step: ${completeError.message}`);
      }

      // Émettre événement de succès
      await emitEvent(step.job_id, step.step_id, 'step_completed', `Completed ${step.step_type}`, output);

      console.log(`[video-step-runner] Step ${step.step_id} completed successfully`);

      // Trigger le prochain step (fire and forget)
      fetch(`${SUPABASE_URL}/functions/v1/video-step-runner`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {});

      return ok({
        success: true,
        stepId: step.step_id,
        stepType: step.step_type,
        output,
      });

    } catch (stepError) {
      const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
      console.error(`[video-step-runner] Step ${step.step_id} failed:`, errorMessage);

      // Marquer comme failed (avec retry automatique si applicable)
      const { data: failResult } = await supabaseAdmin.rpc('fail_step', {
        p_step_id: step.step_id,
        p_error: errorMessage,
      });

      // Émettre événement d'échec
      await emitEvent(step.job_id, step.step_id, 'step_failed', errorMessage, {
        result: failResult,
      });

      // Si retry, relancer le runner
      if (failResult === 'retrying') {
        fetch(`${SUPABASE_URL}/functions/v1/video-step-runner`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {});
      }

      return ok({
        success: false,
        stepId: step.step_id,
        stepType: step.step_type,
        error: errorMessage,
        willRetry: failResult === 'retrying',
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[video-step-runner] Fatal error:', errorMessage);
    return err(errorMessage);
  }
});
