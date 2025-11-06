import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToCloudinary } from '../_shared/cloudinaryUploader.ts';
import { consumeBrandQuotas } from '../_shared/quota.ts';

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

    // 🧪 Environment check
    console.log('🧪 env.check', {
      hasUrl: !!Deno.env.get('SUPABASE_URL'),
      hasAnon: !!Deno.env.get('SUPABASE_ANON_KEY'),
      hasService: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    });

    // 🧪 Queue visibility probes
    const { count: queued } = await supabaseAdmin
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    console.log('🧪 probe.queue_count', { queued: queued ?? 0 });

    // 🧪 Check for legacy 'jobs' table
    try {
      const { data: dbgJobs, error: dbgErr } = await supabaseAdmin
        .from('jobs')
        .select('id')
        .limit(1);
      console.log('🧪 probe.jobs_table', { exists: !dbgErr, sample: dbgJobs?.length ?? 0 });
    } catch {
      console.log('🧪 probe.jobs_table', { exists: false });
    }
    
    console.log(`[WORKER] Boot: ${queued ?? 0} jobs queued in job_queue`);

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
        // 🧪 Warn if claim returns empty but we saw queued jobs
        if ((queued ?? 0) > 0) {
          console.warn('🧪 claim_empty_but_queued_gt0');
        }
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
  console.log('🖼️ [processRenderImages] Starting...', { payload });
  
  // ✅ Adapter au nouveau format de payload
  let imagesToRender = [];
  
  if (payload.images) {
    // Format ancien (compatibilité)
    imagesToRender = payload.images;
  } else if (payload.brief) {
    // ✅ NOUVEAU FORMAT (depuis order_items)
    const { count, briefs } = payload.brief;
    const brandId = payload.brandId;
    
    // Charger le brand kit une fois
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('name, palette, voice, niche')
      .eq('id', brandId)
      .single();
    
    console.log('📦 [processRenderImages] Brand loaded:', brand?.name);
    
    // Convertir chaque brief en objet image avec prompt construit
    imagesToRender = (briefs || [payload.brief]).map((brief: any, i: number) => {
      const { objective, format, style, content } = brief;
      
      // Mapper format vers résolution
      const AR_MAP: Record<string, { w: number; h: number }> = {
        '1:1': { w: 1024, h: 1024 },
        '4:5': { w: 1080, h: 1350 },
        '9:16': { w: 1080, h: 1920 },
        '16:9': { w: 1920, h: 1080 },
      };
      
      const aspectRatio = format?.split(' ')[0] || '1:1';
      const { w, h } = AR_MAP[aspectRatio] || AR_MAP['1:1'];
      
      // Construire prompt enrichi avec le contenu visuel demandé
      const prompt = `${content || 'A detailed subject scene'}.
Style: ${style || 'realistic photo or clean illustration'}.
Context: ${objective || 'social media post'}.
Brand: ${brand?.niche || ''}, tone: ${brand?.voice || 'professional'}.
Colors: ${brand?.palette?.slice(0, 3).join(', ') || 'modern palette'}.
Composition: clear main subject (no empty background), depth, lighting, natural shadows. No text overlays.
Format: ${aspectRatio} aspect ratio optimized.`;
      
      console.log(`🖼️ [processRenderImages] Image ${i + 1}: ${aspectRatio} (${w}x${h})`);
      
      return {
        prompt,
        resolution: `${w}x${h}`,
        aspectRatio,
        brandId,
        briefIndex: i
      };
    });
  } else {
    throw new Error('Invalid payload: missing images or brief');
  }
  
  console.log(`🖼️ [processRenderImages] Processing ${imagesToRender.length} images`);
  
  const results = [];
  
  for (const img of imagesToRender) {
    try {
      // ✅ Appeler alfie-generate-ai-image (public, pas besoin JWT)
      console.log(`🎨 [processRenderImages] Generating image ${results.length + 1}/${imagesToRender.length}`);
      
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('name, palette, voice')
        .eq('id', img.brandId)
        .single();
      
        const { data, error } = await supabaseAdmin.functions.invoke('alfie-generate-ai-image', {
          body: {
            prompt: img.prompt,
            resolution: img.resolution,
            backgroundOnly: false,
            brandKit: brand ? {
              name: brand.name,
              palette: brand.palette,
              voice: brand.voice
            } : undefined
          }
        });
      
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Image generation failed');
      }
      
      const imageBase64 = data?.imageUrl || data?.data?.imageUrl;
      if (!imageBase64) {
        throw new Error('No image URL returned');
      }

      // 🆕 UPLOADER VERS CLOUDINARY
      console.log(`📤 [processRenderImages] Uploading image ${results.length + 1} to Cloudinary...`);

      try {
        const cloudinaryResult = await uploadToCloudinary(imageBase64, {
          folder: `brands/${img.brandId}/images`,
          publicId: `order_${payload.orderId}_img_${results.length + 1}`,
          tags: ['ai-generated', 'worker', `order-${payload.orderId}`],
          context: {
            order_id: String(payload.orderId),
            order_item_id: String(payload.orderItemId),
            brand_id: String(img.brandId),
            aspect_ratio: img.aspectRatio || '9:16'
          }
        });

        console.log(`✅ [processRenderImages] Uploaded: ${cloudinaryResult.secureUrl}`);
        console.log(`📊 Size reduction: ${(imageBase64.length / 1024).toFixed(0)}KB base64 → ${cloudinaryResult.secureUrl.length}B URL`);

        // ✅ Sauvegarder dans media_generations avec URL Cloudinary
        const { error: saveError } = await supabaseAdmin
          .from('media_generations')
          .insert({
            user_id: payload.userId,
            brand_id: img.brandId,
            type: 'image',
            status: 'completed',
            output_url: cloudinaryResult.secureUrl,
            thumbnail_url: cloudinaryResult.secureUrl,
            prompt: img.prompt,
            metadata: {
              orderId: payload.orderId,
              orderItemId: payload.orderItemId,
              aspectRatio: img.aspectRatio,
              resolution: img.resolution,
              source: 'worker-cascade',
              cloudinary_public_id: cloudinaryResult.publicId
            }
          });

        if (saveError) {
          console.warn('⚠️ Failed to save to media_generations:', saveError);
        } else {
          console.log('💾 [processRenderImages] Saved to media_generations');
        }

        // ✅ Sauvegarder dans library_assets avec URL Cloudinary
        const { error: libError } = await supabaseAdmin
          .from('library_assets')
          .insert({
            user_id: payload.userId,
            brand_id: img.brandId,
            order_id: payload.orderId,
            order_item_id: payload.orderItemId,
            type: 'image',
            cloudinary_url: cloudinaryResult.secureUrl,
            format: img.aspectRatio,
            metadata: {
              orderId: payload.orderId,
              orderItemId: payload.orderItemId,
              aspectRatio: img.aspectRatio,
              resolution: img.resolution,
              source: 'worker-cascade',
              cloudinary_public_id: cloudinaryResult.publicId
            }
          });

        if (libError) {
          console.warn('⚠️ Failed to save to library_assets:', libError);
        } else {
          console.log('💾 [processRenderImages] Saved to library_assets');
        }

        results.push({
          url: cloudinaryResult.secureUrl,
          aspectRatio: img.aspectRatio,
          resolution: img.resolution
        });

      } catch (uploadError) {
        console.error(`❌ Cloudinary upload failed for image ${results.length + 1}:`, uploadError);
        throw uploadError;
      }
      
    } catch (imgError) {
      console.error(`❌ Failed to generate image:`, imgError);
      throw imgError; // Propagate pour le retry du job
    }
  }
  
  console.log(`✅ [processRenderImages] Rendered ${results.length} images`);
  
  // 📊 Consommer le quota pour toutes les images
  console.log(`📊 [processRenderImages] Consuming quota: ${results.length} images`);
  try {
    await consumeBrandQuotas(payload.brandId, results.length);
    console.log(`✅ [processRenderImages] Quota consumed: ${results.length} images`);
  } catch (quotaError) {
    console.error('❌ Failed to consume quota:', quotaError);
    // Non-bloquant : on continue même si le quota échoue
  }
  
  return { images: results };
}

async function processRenderCarousels(payload: any): Promise<any> {
  console.log('📚 [processRenderCarousels] Starting...', { payload });
  
  // ✅ Adapter au nouveau format de payload
  let carouselsToRender = [];
  
  if (payload.carousels) {
    // Format ancien (compatibilité)
    carouselsToRender = payload.carousels;
  } else if (payload.brief) {
    // ✅ NOUVEAU FORMAT (depuis order_items)
    const { count, briefs } = payload.brief;
    const brandId = payload.brandId;
    
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('name, palette, voice, niche')
      .eq('id', brandId)
      .single();
    
    console.log('📦 [processRenderCarousels] Brand loaded:', brand?.name);
    
    // Pour chaque brief de carousel, générer un plan
    const planPromises = (briefs || [payload.brief]).map(async (brief: any, idx: number) => {
      const { topic, numSlides, angle } = brief;
      
      // ✅ FIX: S'assurer que numSlides est un nombre
      const slideCount = typeof numSlides === 'number' ? numSlides : (parseInt(String(numSlides)) || 5);
      
      console.log(`📋 [processRenderCarousels] Planning carousel ${idx + 1}:`, {
        topic,
        numSlides: brief.numSlides,
        slideCount,
        angle
      });
      
      // ✅ Appeler alfie-plan-carousel (public)
      const { data, error } = await supabaseAdmin.functions.invoke('alfie-plan-carousel', {
        body: {
          prompt: topic,
          slideCount,
          brandKit: brand ? {
            name: brand.name,
            palette: brand.palette,
            voice: brand.voice,
            niche: brand.niche
          } : undefined
        }
      });
      
      if (error || data?.error) {
        console.error(`❌ [processRenderCarousels] Planning failed:`, {
          error: error?.message,
          dataError: data?.error,
          topic,
          slideCount
        });
        throw new Error(`Carousel planning failed: ${data?.error || error?.message}`);
      }
      
      console.log(`✅ [processRenderCarousels] Carousel ${idx + 1} planned:`, {
        requestedSlides: slideCount,
        returnedSlides: data.slides?.length || 0,
        returnedPrompts: data.prompts?.length || 0,
        hasSlidesArray: Array.isArray(data.slides),
        firstSlide: data.slides?.[0] ? JSON.stringify(data.slides[0]) : 'none'
      });
      
      // ✅ CRITICAL: Valider que le plan contient le bon nombre de slides
      if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
        console.error(`❌ [processRenderCarousels] Invalid plan structure:`, data);
        throw new Error(`Plan returned no slides`);
      }
      
      if (data.slides.length !== slideCount) {
        console.warn(`⚠️ [processRenderCarousels] Slide count mismatch: requested ${slideCount}, got ${data.slides.length}`);
      }
      
      return {
        id: crypto.randomUUID(),
        aspectRatio: payload.aspectRatio || '9:16', // ✅ Utiliser l'aspect ratio du payload
        textVersion: 1,
        slides: data.slides,
        prompts: data.prompts || [],
        style: data.style || 'minimalist',
        brandId
      };
    });
    
    carouselsToRender = await Promise.all(planPromises);
  } else {
    throw new Error('Invalid payload: missing carousels or brief');
  }
  
  console.log(`📚 [processRenderCarousels] Processing ${carouselsToRender.length} carousels`);
  
  const results = [];
  
  for (const carousel of carouselsToRender) {
    const slides = [];
    
    console.log(`🎠 [processRenderCarousels] Rendering carousel ${results.length + 1}/${carouselsToRender.length}:`, {
      totalSlides: carousel.slides.length,
      hasSlides: Array.isArray(carousel.slides),
      slideTypes: carousel.slides.map((s: any) => s.type),
      carouselId: carousel.id
    });
    
    // ✅ VALIDATION: S'assurer qu'il y a des slides à traiter
    if (!carousel.slides || carousel.slides.length === 0) {
      console.error(`❌ [processRenderCarousels] Carousel has no slides to render!`, carousel);
      throw new Error('Carousel has no slides');
    }
    
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('name, palette, voice, niche')
      .eq('id', carousel.brandId)
      .single();
    
    console.log(`🎨 [processRenderCarousels] Starting slide-by-slide generation...`);
    
    for (let i = 0; i < carousel.slides.length; i++) {
      const slide = carousel.slides[i];
      const slidePrompt = carousel.prompts[i] || `Slide ${i + 1}`;
      
      try {
        console.log(`🎨 [processRenderCarousels] Rendering slide ${i + 1}/${carousel.slides.length}`);
        
        // ✅ Utiliser alfie-render-carousel-slide avec userId dans le body
        const { data: slideData, error: slideError } = await supabaseAdmin.functions.invoke(
          'alfie-render-carousel-slide',
          {
            body: {
              userId: payload.userId, // ✅ CRITIQUE: passer userId
              prompt: slidePrompt,
              globalStyle: carousel.style || 'minimalist',
              slideContent: slide,
              brandId: carousel.brandId,
              orderId: payload.orderId,
              carouselId: carousel.id,
              slideIndex: i,
              totalSlides: carousel.slides.length,
              aspectRatio: carousel.aspectRatio || '9:16',
              textVersion: carousel.textVersion || 1,
              renderVersion: 1,
              campaign: 'carousel_generation',
              language: 'FR'
            }
          }
        );
        
        if (slideError || slideData?.error) {
          throw new Error(`Slide ${i + 1} render failed: ${slideData?.error || slideError?.message}`);
        }
        
        console.log(`✅ [processRenderCarousels] Slide ${i + 1} rendered successfully: ${slideData.cloudinary_url}`);
        
        slides.push({
          index: i,
          url: slideData.cloudinary_url,
          publicId: slideData.cloudinary_public_id,
          text: slide
        });
        
      } catch (slideError) {
        console.error(`❌ Failed to generate slide ${i + 1}:`, slideError);
        throw slideError;
      }
    }
    
    // 📊 Consommer le quota pour toutes les slides du carrousel
    console.log(`📊 [processRenderCarousels] Consuming quota: ${slides.length} images for carousel ${carousel.id}`);
    try {
      await consumeBrandQuotas(carousel.brandId, slides.length);
      console.log(`✅ [processRenderCarousels] Quota consumed: ${slides.length} images`);
    } catch (quotaError) {
      console.error('❌ Failed to consume quota:', quotaError);
      // Non-bloquant : on continue même si le quota échoue
    }
    
    results.push({
      carouselId: carousel.id,
      slides,
      totalSlides: slides.length
    });
    
    console.log(`✅ [processRenderCarousels] Carousel ${results.length}/${carouselsToRender.length} completed`);
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
  
  // ✅ STEP 1: Retry to fetch order_items (max 10 attempts over 1 second)
  let orderItems: any[] = [];
  const maxRetries = 10;
  const retryDelay = 100; // ms
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', job.order_id)
      .order('sequence_number');
    
    if (error) {
      console.error(`❌ [Cascade] Error fetching items (attempt ${attempt + 1}):`, error);
    } else if (data && data.length > 0) {
      orderItems = data;
      console.log(`✅ [Cascade] Found ${orderItems.length} order_items (attempt ${attempt + 1})`);
      break;
    }
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  // ✅ STEP 2: Fallback to payload if still no items found
  if (orderItems.length === 0) {
    // 🧪 Explicit log when no items found after retries
    console.warn('🧪 no_items_after_texts', { orderId: job.order_id });
    console.warn('⚠️ [Cascade] No order_items found after retries. Using payload fallback.');
    
    const { imageBriefs = [], carouselBriefs = [], brandId } = job.payload;
    const cascadeJobs: Array<{
      user_id: string;
      order_id: string;
      type: string;
      status: string;
      payload: any;
    }> = [];
    
    // Create jobs from imageBriefs
    imageBriefs.forEach((brief: any, index: number) => {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: 'render_images',
        status: 'queued',
        payload: {
          userId: job.user_id,
          orderId: job.order_id,
          brief,
          textData: result.texts,
          brandId,
          imageIndex: index,
          fallbackMode: true
        }
      });
    });
    
    // Create jobs from carouselBriefs
    carouselBriefs.forEach((brief: any, index: number) => {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: 'render_carousels',
        status: 'queued',
        payload: {
          userId: job.user_id,
          orderId: job.order_id,
          brief,
          textData: result.texts,
          brandId,
          carouselIndex: index,
          fallbackMode: true
        }
      });
    });
    
  if (cascadeJobs.length > 0) {
    // Check for existing jobs with same type AND status to avoid duplicates
    const { data: existingJobs } = await supabaseAdmin
      .from('job_queue')
      .select('id, type, status')
      .eq('order_id', job.order_id)
      .in('status', ['queued', 'running']); // Only check non-terminal states
    
    const existingKeys = new Set(
      existingJobs?.map((j: any) => `${j.type}_${j.status}`) || []
    );
    
    const newJobs = cascadeJobs.filter((j: any) => 
      !existingKeys.has(`${j.type}_${j.status}`)
    );
    
    if (newJobs.length > 0) {
      const { error: cascadeError } = await supabaseAdmin
        .from('job_queue')
        .insert(newJobs);
      
      if (cascadeError) {
        console.error('❌ [Cascade] Failed to create fallback jobs:', cascadeError);
      } else {
        console.log(`✅ [Cascade] Created ${newJobs.length} jobs via FALLBACK`);
        // Trigger worker again to process newly queued jobs
        try {
          await supabaseAdmin.functions.invoke('alfie-job-worker', {
            body: { trigger: 'cascade' }
          });
          console.log('▶️ [Cascade] Worker reinvoked for FALLBACK jobs');
        } catch (e) {
          console.warn('[Cascade] Worker reinvoke error (fallback):', e);
        }
      }
    } else {
      console.log('ℹ️ [Cascade] All fallback jobs already exist');
    }
  }
    
    return; // Exit after fallback
  }
  
  // ✅ STEP 3: Normal cascade from order_items
  const cascadeJobs: Array<{
    user_id: string;
    order_id: string;
    type: string;
    status: string;
    payload: any;
  }> = [];
  
  for (const item of orderItems) {
    if (item.type === 'carousel') {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: 'render_carousels',
        status: 'queued',
        payload: {
          userId: job.user_id, // ✅ Ajouté pour sauvegardes DB
          orderId: job.order_id, // ✅ Ajouté pour traçabilité
          orderItemId: item.id,
          brief: item.brief_json,
          textData: result.texts,
          brandId: job.payload.brandId,
          carouselIndex: item.sequence_number
        }
      });
    } else if (item.type === 'image') {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: 'render_images',
        status: 'queued',
        payload: {
          userId: job.user_id, // ✅ Ajouté pour sauvegardes DB
          orderId: job.order_id, // ✅ Ajouté pour traçabilité
          orderItemId: item.id,
          brief: item.brief_json,
          textData: result.texts,
          brandId: job.payload.brandId,
          imageIndex: item.sequence_number
        }
      });
    }
  }
  
  if (cascadeJobs.length > 0) {
    // Check for existing jobs to avoid duplicates (type + non-terminal status)
    const { data: existingJobs } = await supabaseAdmin
      .from('job_queue')
      .select('id, type, status')
      .eq('order_id', job.order_id)
      .in('status', ['queued','running']);
    
    const existingKeys = new Set(existingJobs?.map((j: any) => `${j.type}_${j.status}`) || []);
    const newJobs = cascadeJobs.filter((j: any) => !existingKeys.has(`${j.type}_${j.status}`));
    
    if (newJobs.length > 0) {
      const { error: cascadeError } = await supabaseAdmin
        .from('job_queue')
        .insert(newJobs);
      
      if (cascadeError) {
        console.error('❌ [Cascade] Failed to create jobs:', cascadeError);
      } else {
        console.log(`✅ [Cascade] Created ${newJobs.length} jobs from order_items`);
        // Trigger worker again to process newly queued jobs
        try {
          await supabaseAdmin.functions.invoke('alfie-job-worker', {
            body: { trigger: 'cascade' }
          });
          console.log('▶️ [Cascade] Worker reinvoked for order_items jobs');
        } catch (e) {
          console.warn('[Cascade] Worker reinvoke error:', e);
        }
      }
    } else {
      console.log('ℹ️ [Cascade] All cascade jobs already exist');
    }
  }
}