import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, validateEnv } from "../_shared/env.ts";
/**
 * DEPRECATED: Sora montage generation is obsolete.
 * Use generate-video via Studio instead.
 */
const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  // Return 410 Gone - function deprecated
  return new Response(JSON.stringify({
    error: "DEPRECATED",
    message: "Cette fonction est obsolète. Utilisez generate-video via le Studio (/studio).",
    redirect: "/studio",
    status: 410
  }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  /* LEGACY CODE ARCHIVED BELOW
  try {
    const { jobId, clipCount, prompts, imageUrls, brandId } = await req.json();
    
    if (!jobId || !clipCount || clipCount < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters. Need jobId and clipCount >= 2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = SUPABASE_URL!;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY!;
    const kieApiKey = Deno.env.get('KIE_AI_API_KEY')!; // tu peux le laisser en Deno.env si tu veux

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating ${clipCount}-clip montage for job ${jobId}`);

    // LEGACY WARNING: Migrated from 'jobs' to 'job_queue'
    // Update job status
    await supabase
      .from('job_queue')
      .update({ 
        status: 'running',
        payload: { progress: 10 },
        updated_at: new Date().toISOString()
      })
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
      .from('job_queue')
      .update({ 
        result: { 
          clipPredictionIds,
          clipCount,
          progress: 30
        },
        updated_at: new Date().toISOString()
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
        .from('job_queue')
        .update({ 
          result: { progress },
          updated_at: new Date().toISOString()
        })
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
      .from('job_queue')
      .update({ 
        status: 'completed',
        result: {
          clipUrls,
          finalVideoUrl,
          clipCount,
          montageStatus: 'pending_concatenation',
          progress: 90
        },
        updated_at: new Date().toISOString()
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
    
    const supabaseUrl = SUPABASE_URL!;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { jobId } = await req.json();
    if (jobId) {
      await supabase
        .from('job_queue')
        .update({ 
          status: 'failed',
          error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  */
});
