import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
// STEP HANDLERS
// =====================================================

async function handleGenKeyframe(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { visualPrompt, identityAnchorId, ratio } = input;
  
  console.log(`[gen_keyframe] Generating keyframe with prompt: ${String(visualPrompt).substring(0, 100)}...`);
  
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

  // Appeler Lovable AI pour générer l'image keyframe
  const imagePrompt = `${visualPrompt}

${anchorConstraints ? `IDENTITY LOCK:\n${anchorConstraints}` : ''}

CRITICAL: Generate a single, clean image suitable as a video keyframe. No text, no split screens.
Aspect ratio: ${ratio || '9:16'}`;

  // Utiliser le endpoint Lovable AI
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/alfie-generate-ai-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
  const { keyframeUrl, visualPrompt, identityAnchorId, ratio, durationSeconds, sceneIndex } = input;
  
  console.log(`[animate_clip] Animating scene ${sceneIndex} with VEO 3.1`);

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

  // Appeler VEO via le endpoint existant
  const veoPayload = {
    prompt: enrichedPrompt,
    referenceImageUrl: keyframeUrl,
    durationSeconds: durationSeconds || 8,
    ratio: ratio || '9:16',
    withAudio: false, // L'audio sera ajouté dans les steps suivants
  };

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-video-veo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
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

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/elevenlabs-tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/elevenlabs-music`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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
  
  console.log(`[mix_audio] Mixing audio tracks`);

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mix-audio-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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
  
  console.log(`[concat_clips] Concatenating ${clipUrls.length} clips`);

  // Utiliser Cloudinary pour la concatenation
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  
  if (clipUrls.length === 1) {
    return { finalVideoUrl: clipUrls[0] };
  }

  // Pour la concatenation, on utilise l'API Cloudinary
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
  
  console.log(`[deliver] Delivering final video for job ${jobId}`);

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
// STEP ROUTER
// =====================================================

async function executeStep(stepType: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (stepType) {
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
    default:
      throw new Error(`Unknown step type: ${stepType}`);
  }
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
    console.log(`[video-step-runner] Processing step ${step.step_id} (${step.step_type})`);

    // Émettre événement de démarrage
    await emitEvent(step.job_id, step.step_id, 'step_started', `Started ${step.step_type}`);

    try {
      // Exécuter le step
      const output = await executeStep(step.step_type, step.input_json);

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
