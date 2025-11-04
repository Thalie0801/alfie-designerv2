import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 [Worker] Starting job processing...');

    // Boot diagnostics: check pending jobs count
    const { count } = await supabaseAdmin
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    console.log(`[WORKER] Boot: ${count ?? 0} jobs queued in job_queue`);

    // Process batch of jobs (3-5 max to avoid HTTP timeout)
    let processedCount = 0;
    const maxJobs = 5;
    const results: any[] = [];

    for (let i = 0; i < maxJobs; i++) {
      // Atomically claim next job using RPC function
      const { data: claimedJobs, error: claimError } = await supabaseAdmin
        .rpc('claim_next_job');

      if (claimError) {
        console.error('❌ [Worker] Error claiming job:', claimError);
        break;
      }

      if (!claimedJobs || claimedJobs.length === 0) {
        console.log(`ℹ️ [Worker] No more jobs to process (processed ${processedCount})`);
        break;
      }

      const job = claimedJobs[0];
      console.log(`🟢 [Worker] start_job`, { jobId: job.id, order_id: job.order_id, type: job.type });

      let result: any = null;
      let error: string | null = null;

      try {
        // Execute job based on type
        switch (job.type) {
          case 'generate_texts':
            result = await processGenerateTexts(job.payload);
            break;
          case 'render_images':
            result = await processRenderImages(job.payload);
            break;
          case 'render_carousels':
            result = await processRenderCarousels(job.payload);
            break;
          case 'generate_video':
            result = await processGenerateVideo(job.payload);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }

        // Mark job as completed
        await supabaseAdmin
          .from('job_queue')
          .update({
            status: 'completed',
            result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        console.log(`✅ [Worker] job_done`, { jobId: job.id, order_id: job.order_id });

        // Create cascade jobs if needed
        if (job.type === 'generate_texts') {
          await createCascadeJobs(job, result, supabaseAdmin);
        }

        processedCount++;
        results.push({ job_id: job.id, success: true });

      } catch (processingError) {
        console.error(`🔴 [Worker] job_failed`, { jobId: job.id, error: processingError instanceof Error ? processingError.message : 'Unknown error' });
        error = processingError instanceof Error ? processingError.message : 'Unknown error';

        // Check retry logic
        const retryCount = job.retry_count || 0;
        const maxRetries = job.max_retries || 3;
        const shouldRetry = retryCount < maxRetries;
        
        if (shouldRetry) {
          // Increment retry count and requeue
          await supabaseAdmin
            .from('job_queue')
            .update({
              status: 'queued',
              retry_count: retryCount + 1,
              error,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          
          console.log(`🔄 [Worker] Job ${job.id} requeued (retry ${retryCount + 1}/${maxRetries})`);
        } else {
          // Mark as failed permanently
          await supabaseAdmin
            .from('job_queue')
            .update({
              status: 'failed',
              error,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          
          console.log(`❌ [Worker] Job ${job.id} failed permanently after ${retryCount} retries`);
        }

        results.push({ job_id: job.id, success: false, error, retried: shouldRetry });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ [Worker] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ========== JOB PROCESSORS ==========

async function processGenerateTexts(payload: any): Promise<any> {
  console.log('📝 [processGenerateTexts] Starting...');
  
  const { brief, brandKit, count = 1, type } = payload;
  
  // Call Lovable AI Gateway to generate texts
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const systemPrompt = type === 'image' 
    ? `Tu es un expert en création de contenu social media. Génère ${count} variations de texte pour une image Instagram/Facebook avec: headline (max 30 car), body (max 125 car), cta (max 20 car), alt (max 100 car).`
    : `Tu es un expert en storytelling pour carrousels. Génère un plan structuré de carousel avec slides cohérentes.`;
  
  const userPrompt = `Brief: ${JSON.stringify(brief)}\nBrand Kit: ${JSON.stringify(brandKit)}`;
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }
  
  const aiResponse = await response.json();
  const generatedText = aiResponse.choices[0]?.message?.content;
  
  console.log('✅ [processGenerateTexts] Generated texts successfully');
  return { texts: generatedText, count, type };
}

async function processRenderImages(payload: any): Promise<any> {
  console.log('🖼️ [processRenderImages] Starting...');
  
  const { images, brandId, orderId } = payload;
  const results = [];
  
  for (const img of images) {
    // Call alfie-render-image
    const response = await supabaseAdmin.functions.invoke('alfie-render-image', {
      body: {
        prompt: img.prompt,
        brandId,
        orderId,
        format: img.format || '1080x1080',
        useNanoBanana: true,
      },
    });
    
    if (response.error) {
      throw new Error(`Image render failed: ${response.error.message}`);
    }
    
    results.push(response.data);
  }
  
  console.log(`✅ [processRenderImages] Rendered ${results.length} images`);
  return { images: results };
}

async function processRenderCarousels(payload: any): Promise<any> {
  console.log('📚 [processRenderCarousels] Starting...');
  
  const { carousels, brandId, orderId, globalStyle } = payload;
  const results = [];
  
  for (const carousel of carousels) {
    const slides = [];
    
    for (let i = 0; i < carousel.slides.length; i++) {
      const slide = carousel.slides[i];
      
      // Call alfie-render-carousel-slide
      const response = await supabaseAdmin.functions.invoke('alfie-render-carousel-slide', {
        body: {
          slideContent: slide,
          globalStyle,
          brandId,
          orderId,
          carouselId: carousel.id,
          slideIndex: i,
          totalSlides: carousel.slides.length,
          aspectRatio: carousel.aspectRatio || '1080x1350',
          textVersion: carousel.textVersion || 'v1',
          renderVersion: 'v1',
        },
      });
      
      if (response.error) {
        throw new Error(`Carousel slide ${i} render failed: ${response.error.message}`);
      }
      
      slides.push(response.data);
    }
    
    results.push({ carouselId: carousel.id, slides });
  }
  
  console.log(`✅ [processRenderCarousels] Rendered ${results.length} carousels`);
  return { carousels: results };
}

async function processGenerateVideo(payload: any): Promise<any> {
  console.log('🎥 [processGenerateVideo] Starting...');
  
  const { slides, narration, brandId, orderId } = payload;
  
  // Phase 1: Generate images for each slide
  const imagePromises = slides.map((slide: any) => 
    supabaseAdmin.functions.invoke('alfie-render-image', {
      body: {
        prompt: slide.prompt,
        brandId,
        orderId,
        format: '1280x720', // 16:9 for video
        useNanoBanana: true,
      },
    })
  );
  
  const imageResults = await Promise.all(imagePromises);
  const imageUrls = imageResults.map(r => r.data?.url).filter(Boolean);
  
  if (imageUrls.length !== slides.length) {
    throw new Error('Some images failed to generate');
  }
  
  // Phase 2: Generate TTS audio (using Lovable AI Gateway)
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const ttsResponse = await fetch('https://ai.gateway.lovable.dev/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-tts', // À vérifier disponibilité
      input: narration,
      voice: 'female_warm',
    }),
  });
  
  if (!ttsResponse.ok) {
    throw new Error('TTS generation failed');
  }
  
  const audioBlob = await ttsResponse.blob();
  
  // Phase 3: Assemble video using Cloudinary Video API
  // Note: ffmpeg n'est pas disponible dans Edge Functions
  // Cette partie nécessite une API externe ou Cloudinary Video transformations
  
  console.log('⚠️ [processGenerateVideo] Video assembly not fully implemented (needs external service or Cloudinary Video API)');
  
  return {
    imageUrls,
    audioGenerated: true,
    message: 'Video slideshow feature requires external video assembly service',
  };
}

// ========== CASCADE JOB CREATION ==========

async function createCascadeJobs(job: any, result: any, supabaseAdmin: any): Promise<void> {
  console.log('📋 [Cascade] Creating follow-up jobs for order:', job.order_id);
  
  const cascadeJobs = [];
  
  // Create render_images jobs
  if (job.payload.numImages > 0 && result.texts) {
    for (let i = 0; i < job.payload.numImages; i++) {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: 'render_images',
        status: 'queued',
        payload: {
          textData: result.texts[i] || {},
          brandId: job.payload.brandId,
          imageIndex: i
        }
      });
    }
  }
  
  // Create render_carousels jobs
  if (job.payload.numCarousels > 0 && result.texts) {
    for (let i = 0; i < job.payload.numCarousels; i++) {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: 'render_carousels',
        status: 'queued',
        payload: {
          carouselData: result.texts[job.payload.numImages + i] || {},
          brandId: job.payload.brandId,
          carouselIndex: i
        }
      });
    }
  }
  
  if (cascadeJobs.length > 0) {
    const { error: cascadeError } = await supabaseAdmin
      .from('job_queue')
      .insert(cascadeJobs);
    
    if (cascadeError) {
      console.error('❌ [Cascade] Failed to create jobs:', cascadeError);
    } else {
      console.log(`✅ [Cascade] Created ${cascadeJobs.length} follow-up jobs`);
    }
  }
}