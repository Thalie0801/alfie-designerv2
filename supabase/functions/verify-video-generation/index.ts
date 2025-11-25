import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

import { corsHeaders } from "../_shared/cors.ts";
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  REPLICATE_API_TOKEN,
  validateEnv,
} from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}
/**
 * Vérifie qu'une vidéo Replicate est prête et valide
 * Utilisé après la génération pour s'assurer que le fichier est accessible
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobId, predictionId } = await req.json();
    
    if (!jobId || !predictionId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId or predictionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN is not configured');
    }

    const supabaseUrl = SUPABASE_URL!;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY!;
    const replicateToken = REPLICATE_API_TOKEN!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Verifying video for job ${jobId}, prediction ${predictionId}`);

    // Update job to checking status
    await supabase
      .from('jobs')
      .update({ status: 'checking', progress: 90 })
      .eq('id', jobId);

    // Fetch prediction status from Replicate
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();

    if (prediction.status === 'failed') {
      await supabase
        .from('jobs')
        .update({ 
          status: 'failed', 
          error: prediction.error || 'Video generation failed'
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Generation failed',
          details: prediction.error 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prediction.status !== 'succeeded' || !prediction.output) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: prediction.status,
          message: 'Video not ready yet' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

    // Verify video URL is accessible
    const videoCheck = await fetch(videoUrl, { method: 'HEAD' });
    if (!videoCheck.ok) {
      throw new Error('Video URL not accessible');
    }

    console.log(`Video verified: ${videoUrl}`);

    // Update job to ready
    await supabase
      .from('jobs')
      .update({ 
        status: 'ready',
        progress: 100,
        output_data: { 
          videoUrl,
          duration: prediction.metrics?.predict_time || 0
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Get job details to create media generation record
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (job) {
      // Create media generation record
      await supabase
        .from('media_generations')
        .insert({
          user_id: job.user_id,
          brand_id: job.input_data.brandId,
          job_id: jobId,
          type: 'video',
          prompt: job.input_data.prompt,
          input_url: job.input_data.imageUrl,
          output_url: videoUrl,
          status: 'completed',
          woofs: job.input_data.woofCost || 1,
          engine: 'sora',
          duration_seconds: Math.ceil(prediction.metrics?.predict_time || 10),
          metadata: {
            predictionId,
            aspectRatio: job.input_data.aspectRatio || '9:16'
          }
        });

      // Consume brand quota
      if (job.input_data.brandId) {
        const woofCost = job.input_data.woofCost || 1;
        await supabase.rpc('consume_brand_quota', {
          p_brand_id: job.input_data.brandId,
          p_woofs: woofCost,
          p_videos: 1
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        videoUrl,
        status: 'ready'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Video verification error:', error);

    try {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const { jobId } = await req.json().catch(() => ({ jobId: null }));
      if (jobId) {
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: error.message,
          })
          .eq('id', jobId);
      }
    } catch (e) {
      console.error('Failed to update job status after error:', e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
