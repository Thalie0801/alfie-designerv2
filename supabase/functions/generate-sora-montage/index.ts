import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Génère un montage de plusieurs clips Sora via Kie AI
 * Utilisé pour créer des vidéos de 20-30s à partir de plusieurs clips de 10s
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, clipCount, prompts, imageUrls, brandId } = await req.json();
    
    if (!jobId || !clipCount || clipCount < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters. Need jobId and clipCount >= 2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiKey = Deno.env.get('KIE_AI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating ${clipCount}-clip montage for job ${jobId}`);

    // Update job status
    await supabase
      .from('jobs')
      .update({ status: 'running', progress: 10 })
      .eq('id', jobId);

    const clipPromises: Promise<string>[] = [];
    const clipPredictionIds: string[] = [];

    // Generate all clips in parallel
    for (let i = 0; i < clipCount; i++) {
      const prompt = Array.isArray(prompts) ? prompts[i] : prompts;
      const imageUrl = Array.isArray(imageUrls) ? imageUrls[i] : imageUrls;

      const clipPromise = (async () => {
        console.log(`Generating clip ${i + 1}/${clipCount}`);
        
        const payload: any = {
          prompt: prompt || `High quality video clip, part ${i + 1}`,
          duration: 10,
          aspect_ratio: '9:16'
        };

        if (imageUrl) {
          payload.image = imageUrl;
        }

        const response = await fetch('https://api.kie.ai/v1/video/sora2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${kieApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Kie AI API error for clip ${i + 1}: ${response.status}`);
        }

        const data = await response.json();
        clipPredictionIds.push(data.id);
        
        return data.id;
      })();

      clipPromises.push(clipPromise);
    }

    // Wait for all clip generations to start
    await Promise.all(clipPromises);

    // Update progress
    await supabase
      .from('jobs')
      .update({ 
        progress: 30,
        output_data: { 
          clipPredictionIds,
          clipCount 
        }
      })
      .eq('id', jobId);

    // Poll for all clips to complete
    const maxAttempts = 120; // 10 minutes total
    let attempts = 0;
    const clipUrls: string[] = [];

    while (attempts < maxAttempts && clipUrls.length < clipCount) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s between checks
      attempts++;

      const progress = 30 + Math.floor((clipUrls.length / clipCount) * 50);
      await supabase
        .from('jobs')
        .update({ progress })
        .eq('id', jobId);

      for (let i = 0; i < clipPredictionIds.length; i++) {
        if (clipUrls[i]) continue; // Already got this clip

        const predictionId = clipPredictionIds[i];
        const response = await fetch(`https://api.kie.ai/v1/video/${predictionId}`, {
          headers: {
            'Authorization': `Bearer ${kieApiKey}`,
          },
        });

        if (!response.ok) continue;

        const data = await response.json();
        
        if (data.status === 'succeeded' && data.output) {
          const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
          clipUrls[i] = videoUrl;
          console.log(`Clip ${i + 1} ready: ${videoUrl}`);
        }
      }
    }

    if (clipUrls.length < clipCount) {
      throw new Error(`Only ${clipUrls.length}/${clipCount} clips completed`);
    }

    console.log(`All ${clipCount} clips ready, creating montage...`);

    // Store individual clips as video_segments
    for (let i = 0; i < clipUrls.length; i++) {
      await supabase
        .from('video_segments')
        .insert({
          parent_video_id: null, // Will be linked after montage
          segment_index: i,
          segment_url: clipUrls[i],
          duration_seconds: 10,
          is_temporary: true
        });
    }

    // For now, return the first clip as the final video
    // TODO: Implement actual video concatenation using FFmpeg or similar
    const finalVideoUrl = clipUrls[0];

    await supabase
      .from('jobs')
      .update({ 
        status: 'checking',
        progress: 90,
        output_data: {
          clipUrls,
          finalVideoUrl,
          clipCount,
          montageStatus: 'pending_concatenation'
        }
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({ 
        success: true,
        clipUrls,
        finalVideoUrl,
        clipCount,
        message: 'Clips ready. Montage assembly pending.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Montage generation error:', error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { jobId } = await req.json();
    if (jobId) {
      await supabase
        .from('jobs')
        .update({ 
          status: 'failed',
          error: error.message
        })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
