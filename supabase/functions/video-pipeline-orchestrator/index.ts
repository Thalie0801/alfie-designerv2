import { createClient } from "npm:@supabase/supabase-js@2";

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
  console.error(`[video-pipeline-orchestrator] Error: ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// =====================================================
// INTERFACES
// =====================================================

interface Scene {
  sceneIndex: number;
  visualPrompt: string;
  voiceoverText?: string;
  durationSec?: number;
}

interface AudioSettings {
  musicPrompt?: string;
  voiceId?: string;
  musicVolume?: number;
  voiceVolume?: number;
}

interface PipelineRequest {
  userId: string;
  brandId?: string;
  script: {
    scenes: Scene[];
    globalVoiceover?: string;
  };
  identityAnchorId?: string;
  audioSettings?: AudioSettings;
  ratio?: '9:16' | '16:9' | '1:1';
}

// =====================================================
// STEP CREATION
// =====================================================

interface StepDef {
  step_type: string;
  step_index: number;
  input_json: Record<string, unknown>;
}

function buildPipelineSteps(request: PipelineRequest, jobId: string): StepDef[] {
  const steps: StepDef[] = [];
  let stepIndex = 0;
  const { scenes, globalVoiceover } = request.script;
  const audioSettings = request.audioSettings ?? {};

  // Pour chaque scène: gen_keyframe + animate_clip
  for (const scene of scenes) {
    // Step: Générer keyframe
    steps.push({
      step_type: 'gen_keyframe',
      step_index: stepIndex++,
      input_json: {
        sceneIndex: scene.sceneIndex,
        visualPrompt: scene.visualPrompt,
        identityAnchorId: request.identityAnchorId,
        ratio: request.ratio ?? '9:16',
        jobId,
      },
    });

    // Step: Animer le clip
    steps.push({
      step_type: 'animate_clip',
      step_index: stepIndex++,
      input_json: {
        sceneIndex: scene.sceneIndex,
        visualPrompt: scene.visualPrompt,
        identityAnchorId: request.identityAnchorId,
        ratio: request.ratio ?? '9:16',
        durationSeconds: scene.durationSec ?? 8,
        // keyframeUrl sera injecté depuis le output du step précédent
        jobId,
      },
    });
  }

  // Step: Voiceover (global ou concaténé des scènes)
  const voiceoverText = globalVoiceover || scenes.map(s => s.voiceoverText || '').filter(Boolean).join(' ');
  if (voiceoverText) {
    steps.push({
      step_type: 'voiceover',
      step_index: stepIndex++,
      input_json: {
        text: voiceoverText,
        voiceId: audioSettings.voiceId,
        language: 'fr',
        jobId,
      },
    });
  }

  // Step: Music (si prompt fourni)
  if (audioSettings.musicPrompt) {
    const totalDuration = scenes.reduce((sum, s) => sum + (s.durationSec ?? 8), 0);
    steps.push({
      step_type: 'music',
      step_index: stepIndex++,
      input_json: {
        prompt: audioSettings.musicPrompt,
        durationSeconds: totalDuration + 5, // Un peu plus long pour le fondu
        jobId,
      },
    });
  }

  // Step: Concat clips (si plusieurs scènes)
  if (scenes.length > 1) {
    steps.push({
      step_type: 'concat_clips',
      step_index: stepIndex++,
      input_json: {
        // clipUrls sera construit depuis les outputs des animate_clip
        sceneCount: scenes.length,
        jobId,
      },
    });
  }

  // Step: Mix audio
  steps.push({
    step_type: 'mix_audio',
    step_index: stepIndex++,
    input_json: {
      // URLs seront injectées depuis les outputs précédents
      voiceVolume: audioSettings.voiceVolume ?? 100,
      musicVolume: audioSettings.musicVolume ?? 15,
      originalVideoVolume: 0, // On strip l'audio VEO natif
      jobId,
    },
  });

  // Step: Deliver
  steps.push({
    step_type: 'deliver',
    step_index: stepIndex++,
    input_json: {
      userId: request.userId,
      brandId: request.brandId,
      jobId,
    },
  });

  return steps;
}

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return err('Missing authorization header', 401);
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return err('Invalid token', 401);
    }

    // Parser la requête
    const body = await req.json() as PipelineRequest;
    
    // Validation minimale
    if (!body.script?.scenes?.length) {
      return err('At least one scene is required', 400);
    }

    const userId = body.userId || user.id;
    const brandId = body.brandId;

    console.log(`[video-pipeline-orchestrator] Creating pipeline for user ${userId} with ${body.script.scenes.length} scenes`);

    // 1. Créer le job parent dans job_queue
    const { data: job, error: jobError } = await supabaseAdmin
      .from('job_queue')
      .insert({
        user_id: userId,
        brand_id: brandId,
        type: 'video_pipeline',
        status: 'queued',
        payload: {
          sceneCount: body.script.scenes.length,
          ratio: body.ratio ?? '9:16',
          identityAnchorId: body.identityAnchorId,
          audioSettings: body.audioSettings,
        },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    const jobId = job.id;
    console.log(`[video-pipeline-orchestrator] Created job ${jobId}`);

    // 2. Créer les steps
    const stepDefs = buildPipelineSteps({ ...body, userId }, jobId);
    
    const stepsToInsert = stepDefs.map(s => ({
      job_id: jobId,
      step_type: s.step_type,
      step_index: s.step_index,
      input_json: s.input_json,
      status: s.step_index === 0 ? 'queued' : 'pending', // Seul le premier step est queued
    }));

    const { error: stepsError } = await supabaseAdmin
      .from('job_steps')
      .insert(stepsToInsert);

    if (stepsError) {
      throw new Error(`Failed to create steps: ${stepsError.message}`);
    }

    console.log(`[video-pipeline-orchestrator] Created ${stepsToInsert.length} steps`);

    // 3. Émettre événement de création
    await supabaseAdmin.from('job_events').insert({
      job_id: jobId,
      event_type: 'pipeline_created',
      message: `Pipeline created with ${stepsToInsert.length} steps`,
      metadata: {
        sceneCount: body.script.scenes.length,
        stepTypes: stepDefs.map(s => s.step_type),
      },
    });

    // 4. Déclencher le step runner (fire and forget)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/video-step-runner`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    }).catch(e => console.error('[video-pipeline-orchestrator] Failed to trigger step runner:', e));

    return ok({
      success: true,
      jobId,
      stepCount: stepsToInsert.length,
      steps: stepDefs.map(s => ({ type: s.step_type, index: s.step_index })),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[video-pipeline-orchestrator] Fatal error:', errorMessage);
    return err(errorMessage);
  }
});
