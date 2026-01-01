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
    plannedBeats: [] as Array<{ sceneIndex: number; visualPrompt: string; voiceoverText: string; durationSec: number }>,
  };

  for (const step of previousSteps || []) {
    const output = step.output_json as Record<string, unknown> | null;
    if (!output) continue;

    // ✅ Collect planned beats from plan_script
    if (step.step_type === 'plan_script' && output.beats) {
      outputs.plannedBeats = output.beats;
      console.log(`[getStepOutputs] Collected ${(output.beats as unknown[]).length} planned beats from plan_script`);
    }
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

  // ✅ For gen_keyframe: inject visualPrompt from planned beats
  if (stepType === 'gen_keyframe') {
    const sceneIndex = (input.sceneIndex as number) ?? 0;
    const plannedBeats = previousOutputs.plannedBeats as Array<{ visualPrompt?: string }>;
    if (plannedBeats && plannedBeats[sceneIndex]?.visualPrompt && !input.visualPrompt) {
      enriched.visualPrompt = plannedBeats[sceneIndex].visualPrompt;
      console.log(`[enrichInput] ✅ Injected visualPrompt for keyframe scene ${sceneIndex}: ${String(enriched.visualPrompt).substring(0, 80)}...`);
    }
  }

  // For animate_clip: inject corresponding keyframe + visualPrompt from beats
  if (stepType === 'animate_clip') {
    const sceneIndex = (input.sceneIndex as number) ?? 0;
    const keyframes = previousOutputs.keyframes as string[];
    if (keyframes && keyframes[sceneIndex]) {
      enriched.keyframeUrl = keyframes[sceneIndex];
    }
    // ✅ Also inject visualPrompt for animate_clip
    const plannedBeats = previousOutputs.plannedBeats as Array<{ visualPrompt?: string }>;
    if (plannedBeats && plannedBeats[sceneIndex]?.visualPrompt && !input.visualPrompt) {
      enriched.visualPrompt = plannedBeats[sceneIndex].visualPrompt;
      console.log(`[enrichInput] ✅ Injected visualPrompt for clip scene ${sceneIndex}: ${String(enriched.visualPrompt).substring(0, 80)}...`);
    }
  }

  // ✅ For voiceover: inject text from planned beats if not provided
  if (stepType === 'voiceover') {
    const plannedBeats = previousOutputs.plannedBeats as Array<{ voiceoverText?: string }>;
    if (plannedBeats && plannedBeats.length > 0 && !input.text) {
      const voiceoverText = plannedBeats.map(b => b.voiceoverText).filter(Boolean).join(' ');
      if (voiceoverText) {
        enriched.text = voiceoverText;
        console.log(`[enrichInput] ✅ Injected voiceover text from beats: ${voiceoverText.substring(0, 80)}...`);
      }
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

// Helper: Charger un Subject Pack depuis la DB
interface SubjectPack {
  id: string;
  name: string;
  pack_type: string;
  master_image_url: string;
  anchor_a_url: string | null;
  anchor_b_url: string | null;
  identity_prompt: string;
  negative_prompt: string;
  constraints_json: Record<string, unknown>;
}

async function loadSubjectPack(packId: string): Promise<SubjectPack | null> {
  if (!packId) return null;
  
  const { data, error } = await supabaseAdmin
    .from('subject_packs')
    .select('id, name, pack_type, master_image_url, anchor_a_url, anchor_b_url, identity_prompt, negative_prompt, constraints_json')
    .eq('id', packId)
    .single();
  
  if (error || !data) {
    console.warn(`[video-step-runner] Could not load subjectPack for ${packId}:`, error?.message);
    return null;
  }
  
  return data as SubjectPack;
}

async function handleGenKeyframe(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { visualPrompt, identityAnchorId, subjectPackId, ratio, userId, brandId, useBrandKit, useLipSync } = input;
  
  console.log(`[gen_keyframe] userId: ${userId}, brandId: ${brandId}, useBrandKit: ${useBrandKit}, useLipSync: ${useLipSync}`);
  console.log(`[gen_keyframe] subjectPackId: ${subjectPackId}, identityAnchorId: ${identityAnchorId}`);
  console.log(`[gen_keyframe] Generating keyframe with prompt: ${String(visualPrompt).substring(0, 100)}...`);
  
  // Charger le Brand Kit si activé
  let brandKit: Record<string, unknown> | null = null;
  if (useBrandKit !== false && brandId) {
    brandKit = await loadBrandKit(String(brandId));
    console.log(`[gen_keyframe] Loaded brandKit: ${brandKit?.name || 'none'}`);
  }
  
  // Variables pour le contexte subject/identity
  let subjectContext = '';
  let negativeContext = '';
  let refImageUrl: string | null = null;
  
  // Priorité 1: Subject Pack (nouveau système)
  if (subjectPackId) {
    const subjectPack = await loadSubjectPack(String(subjectPackId));
    if (subjectPack) {
      console.log(`[gen_keyframe] Loaded subjectPack: ${subjectPack.name} (${subjectPack.pack_type})`);
      
      // Utiliser l'image master comme référence principale
      refImageUrl = subjectPack.master_image_url;
      
      // Construire le contexte d'identité
      if (subjectPack.identity_prompt) {
        subjectContext = `SUBJECT IDENTITY (${subjectPack.pack_type.toUpperCase()}):\n${subjectPack.identity_prompt}\n`;
      }
      if (subjectPack.negative_prompt) {
        negativeContext = `AVOID: ${subjectPack.negative_prompt}\n`;
      }
      
      // Contraintes du pack
      const constraints = subjectPack.constraints_json || {};
      if (constraints.face_lock) subjectContext += 'MAINTAIN EXACT face shape, eye color, hair style. ';
      if (constraints.outfit_lock) subjectContext += 'MAINTAIN EXACT outfit and clothing colors. ';
      if (constraints.palette_lock) subjectContext += 'MAINTAIN color palette consistency. ';
    }
  }
  // Fallback: Identity Anchor (ancien système)
  else if (identityAnchorId) {
    const { data: anchor } = await supabaseAdmin
      .from('identity_anchors')
      .select('*')
      .eq('id', identityAnchorId)
      .single();
    
    if (anchor) {
      refImageUrl = anchor.ref_image_url;
      const constraints = anchor.constraints_json as Record<string, boolean> | null;
      if (constraints?.face_lock) subjectContext += 'MAINTAIN EXACT face shape, eye color, hair style. ';
      if (constraints?.outfit_lock) subjectContext += 'MAINTAIN EXACT outfit and clothing colors. ';
      if (constraints?.palette_lock) subjectContext += 'MAINTAIN color palette consistency. ';
    }
  }

  // Instructions Lip-Sync pour personnage de face
  const lipSyncInstructions = useLipSync 
    ? `\n\nLIP-SYNC MODE:\n- Character must be facing the camera DIRECTLY (frontal view)\n- Full face visible, mouth clearly visible\n- Eyes looking at camera\n- Professional lighting on face\n- Ready for lip synchronization animation` 
    : '';

  // Prompt pour générer l'image keyframe
  const imagePrompt = `${subjectContext}${visualPrompt}
${lipSyncInstructions}
${negativeContext}
${subjectContext ? `IDENTITY LOCK:\n${subjectContext}` : ''}

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
      isIntermediate: true, // ✅ Mark keyframes as intermediate (won't show in library)
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
  const { keyframeUrl, visualPrompt, identityAnchorId, subjectPackId, ratio, durationSeconds, sceneIndex, userId, brandId, useLipSync } = input;
  
  console.log(`[animate_clip] Animating scene ${sceneIndex} with VEO 3.1`);
  console.log(`[animate_clip] userId: ${userId}, brandId: ${brandId}, useLipSync: ${useLipSync}`);
  console.log(`[animate_clip] subjectPackId: ${subjectPackId}, keyframe: ${keyframeUrl}`);

  if (!keyframeUrl) {
    throw new Error('Missing keyframeUrl for animate_clip step');
  }

  if (!userId) {
    throw new Error('Missing userId for animate_clip step');
  }

  // Variables pour le contexte subject/identity
  let subjectPrompt = '';
  
  // Priorité 1: Subject Pack (nouveau système)
  if (subjectPackId) {
    const subjectPack = await loadSubjectPack(String(subjectPackId));
    if (subjectPack) {
      console.log(`[animate_clip] Loaded subjectPack: ${subjectPack.name}`);
      
      if (subjectPack.identity_prompt) {
        subjectPrompt = `SUBJECT (${subjectPack.pack_type}): ${subjectPack.identity_prompt}\n`;
      }
      
      const constraints = subjectPack.constraints_json || {};
      if (constraints.face_lock) subjectPrompt += 'MAINTAIN character identity throughout. ';
      if (constraints.camera_angle_lock) subjectPrompt += 'Keep consistent camera angle. ';
    }
  }
  // Fallback: Identity Anchor (ancien système)
  else if (identityAnchorId) {
    const { data: anchor } = await supabaseAdmin
      .from('identity_anchors')
      .select('constraints_json')
      .eq('id', identityAnchorId)
      .single();
    
    if (anchor?.constraints_json) {
      const constraints = anchor.constraints_json as Record<string, boolean>;
      if (constraints.face_lock) subjectPrompt += 'MAINTAIN character identity throughout. ';
      if (constraints.camera_angle) subjectPrompt += 'Keep consistent camera angle. ';
    }
  }

  // Instructions Lip-Sync pour VEO
  const lipSyncInstructions = useLipSync 
    ? `\n\nLIP-SYNC ANIMATION:\n- Character speaks directly to camera\n- Realistic mouth movements synchronized with speech\n- Natural facial expressions while talking\n- Maintain frontal camera angle throughout\n- Eyes engaged with viewer` 
    : '';

  // Enrichir le prompt pour VEO
  const enrichedPrompt = `${subjectPrompt}${visualPrompt}
${lipSyncInstructions}

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
      type: 'video', // ✅ Corrected: 'video' instead of 'video_pipeline' (constraint fix)
      output_url: finalVideoUrl as string,
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
  const { prompt, ratio, visualStyle, identityAnchorId, subjectPackId, userId, brandId, useBrandKit } = input;
  
  console.log(`[gen_image] userId: ${userId}, brandId: ${brandId}, useBrandKit: ${useBrandKit}`);
  console.log(`[gen_image] subjectPackId: ${subjectPackId}, identityAnchorId: ${identityAnchorId}`);
  console.log(`[gen_image] Generating image with prompt: ${String(prompt).substring(0, 100)}...`);

  // Charger le Brand Kit si activé
  let brandKit: Record<string, unknown> | null = null;
  if (useBrandKit !== false && brandId) {
    brandKit = await loadBrandKit(String(brandId));
    console.log(`[gen_image] Loaded brandKit: ${brandKit?.name || 'none'}`);
  }

  // ✅ Subject Pack: charger et enrichir le prompt
  let subjectContext = '';
  let negativeContext = '';
  let referenceImageUrl: string | null = null;
  
  if (subjectPackId) {
    const subjectPack = await loadSubjectPack(String(subjectPackId));
    if (subjectPack) {
      console.log(`[gen_image] ✅ Loaded subjectPack: ${subjectPack.name} (${subjectPack.pack_type})`);
      
      // Image Master comme référence principale
      referenceImageUrl = subjectPack.master_image_url;
      
      // Contexte d'identité
      if (subjectPack.identity_prompt) {
        subjectContext = `\n\n=== SUBJECT IDENTITY (${subjectPack.pack_type.toUpperCase()}) ===\n${subjectPack.identity_prompt}\n`;
        subjectContext += `CRITICAL: The character/subject must be EXACTLY as shown in the reference image.\n`;
        subjectContext += `- SAME face shape, SAME eye color, SAME fur/hair color and texture\n`;
        subjectContext += `- SAME accessories, SAME outfit, SAME style\n`;
        subjectContext += `- ONE single subject in frame, no variations, no alternate versions\n`;
      }
      if (subjectPack.negative_prompt) {
        negativeContext = `AVOID: ${subjectPack.negative_prompt}`;
      }
      
      // Contraintes du pack
      const constraints = subjectPack.constraints_json || {};
      if (constraints.face_lock) subjectContext += 'FACE LOCK: Maintain exact facial features. ';
      if (constraints.outfit_lock) subjectContext += 'OUTFIT LOCK: Maintain exact clothing. ';
      if (constraints.palette_lock) subjectContext += 'PALETTE LOCK: Maintain color consistency. ';
    }
  }
  
  // Enrichir le prompt avec le contexte Subject Pack
  const enrichedPrompt = subjectContext 
    ? `${prompt}${subjectContext}${negativeContext ? `\n${negativeContext}` : ''}`
    : prompt;

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
      prompt: enrichedPrompt,
      ratio: ratio || '9:16',
      visualStyle: visualStyle || 'photorealistic',
      identityAnchorId,
      referenceImageUrl, // ✅ Pass Subject Pack Master as reference
      negativePrompt: negativeContext || undefined,
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
  const { slideIndex, slide, ratio, visualStyle, subjectPackId, userId, brandId, useBrandKit } = input;
  
  console.log(`[gen_slide] userId: ${userId}, brandId: ${brandId}, useBrandKit: ${useBrandKit}`);
  console.log(`[gen_slide] subjectPackId: ${subjectPackId}`);
  console.log(`[gen_slide] Generating slide ${slideIndex}`);

  // Charger le Brand Kit si activé
  let brandKit: Record<string, unknown> | null = null;
  if (useBrandKit !== false && brandId) {
    brandKit = await loadBrandKit(String(brandId));
    console.log(`[gen_slide] Loaded brandKit: ${brandKit?.name || 'none'}`);
  }

  // ✅ Subject Pack: charger et enrichir le prompt
  let subjectContext = '';
  let referenceImageUrl: string | null = null;
  
  if (subjectPackId) {
    const subjectPack = await loadSubjectPack(String(subjectPackId));
    if (subjectPack) {
      console.log(`[gen_slide] ✅ Loaded subjectPack: ${subjectPack.name} (${subjectPack.pack_type})`);
      
      // Image Master comme référence
      referenceImageUrl = subjectPack.master_image_url;
      
      if (subjectPack.identity_prompt) {
        subjectContext = `\n\nSUBJECT (${subjectPack.pack_type}): ${subjectPack.identity_prompt}`;
        subjectContext += `\nCRITICAL: Keep the EXACT same character/subject as in the reference across all slides.`;
      }
    }
  }

  const slideData = slide as Record<string, unknown> | undefined;
  const basePrompt = slideData?.visualPrompt || slideData?.titleOnImage || 'Professional slide background';
  const enrichedPrompt = subjectContext ? `${basePrompt}${subjectContext}` : basePrompt;

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
      prompt: enrichedPrompt,
      slideIndex,
      slide: slideData,
      ratio: ratio || '9:16',
      visualStyle: visualStyle || 'photorealistic',
      referenceImageUrl, // ✅ Pass Subject Pack Master as reference
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
  const { script, clipCount, durationTotal, subjectPackId, brandId, useBrandKit } = input;
  const targetClipCount = (clipCount as number) || 3;
  
  console.log(`[plan_script] Planning script for ${targetClipCount} clips using LLM`);

  // Load Subject Pack to include character in prompts
  let subjectDescription = '';
  let subjectName = '';
  if (subjectPackId) {
    const subjectPack = await loadSubjectPack(String(subjectPackId));
    if (subjectPack) {
      subjectDescription = subjectPack.identity_prompt || '';
      subjectName = subjectPack.name || '';
      console.log(`[plan_script] Using subject: ${subjectName}`);
    }
  }

  // Load Brand Kit context
  let brandContext = '';
  if (useBrandKit !== false && brandId) {
    const brandKit = await loadBrandKit(String(brandId));
    if (brandKit) {
      brandContext = `Marque: ${brandKit.name}, Niche: ${brandKit.niche || 'N/A'}`;
    }
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  // If no API key or no script, fallback to simple split
  if (!LOVABLE_API_KEY || !(script as string)?.trim()) {
    console.log(`[plan_script] No API key or empty script, using simple split`);
    return fallbackPlanScript(script as string, targetClipCount, durationTotal as number);
  }

  const systemPrompt = `Tu es un réalisateur de mini-films publicitaires.
Découpe ce script en ${targetClipCount} scènes visuelles distinctes.

${subjectDescription ? `PERSONNAGE PRINCIPAL (doit apparaître dans TOUTES les scènes avec ces caractéristiques exactes): ${subjectDescription}` : ''}
${brandContext ? `CONTEXTE DE MARQUE: ${brandContext}` : ''}

Pour chaque scène, génère:
- Un visualPrompt TRÈS DÉTAILLÉ pour la génération vidéo (description visuelle complète incluant: le personnage avec ses traits distinctifs, l'environnement, l'éclairage, l'angle de caméra, l'action)
- Le texte voiceover correspondant (ce que la voix dira pendant cette scène)
- La durée recommandée (8 secondes par défaut)

RÈGLES CRITIQUES:
1. Chaque visualPrompt DOIT mentionner le personnage principal avec ses caractéristiques exactes (couleurs, style, vêtements)
2. Les scènes doivent être visuellement distinctes mais le personnage doit être identique
3. Utilise un langage cinématographique (close-up, wide shot, pan, etc.)

Réponds UNIQUEMENT en JSON valide:
{
  "beats": [
    {
      "sceneIndex": 0,
      "visualPrompt": "Description visuelle détaillée avec le personnage...",
      "voiceoverText": "Texte du voiceover...",
      "durationSec": 8
    }
  ]
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: script as string || 'Crée une vidéo promotionnelle dynamique' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[plan_script] LLM call failed: ${response.status} - ${errorText}`);
      return fallbackPlanScript(script as string, targetClipCount, durationTotal as number);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[plan_script] No JSON found in LLM response`);
      return fallbackPlanScript(script as string, targetClipCount, durationTotal as number);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[plan_script] ✅ Generated ${parsed.beats?.length || 0} beats with LLM`);

    return {
      beats: parsed.beats || [],
      clipCount: parsed.beats?.length || targetClipCount,
    };
  } catch (error) {
    console.error(`[plan_script] LLM error, falling back to simple split:`, error);
    return fallbackPlanScript(script as string, targetClipCount, durationTotal as number);
  }
}

// Fallback function for simple script splitting
function fallbackPlanScript(script: string, clipCount: number, durationTotal: number): Record<string, unknown> {
  const lines = (script || '').split(/[.!?]+/).filter(l => l.trim());
  const beatsPerClip = Math.ceil(lines.length / clipCount);
  
  const beats = [];
  for (let i = 0; i < clipCount; i++) {
    const clipLines = lines.slice(i * beatsPerClip, (i + 1) * beatsPerClip);
    beats.push({
      sceneIndex: i,
      visualPrompt: clipLines.join('. ') || `Scene ${i + 1}`,
      voiceoverText: clipLines.join('. '),
      durationSec: Math.floor((durationTotal || 24) / clipCount),
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
