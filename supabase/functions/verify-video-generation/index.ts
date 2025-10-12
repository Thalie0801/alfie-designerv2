import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Vérifie qu'une vidéo Replicate est prête et valide
 * Utilisé après la génération pour s'assurer que le fichier est accessible
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, predictionId } = await req.json();
    
    if (!jobId || !predictionId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId or predictionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN')!;
    
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
