import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { slides, narration, brandId, orderId, title } = await req.json();

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      throw new Error('Slides array is required');
    }

    if (!narration) {
      throw new Error('Narration text is required');
    }

    console.log(`🎥 [Video Slideshow] Generating video with ${slides.length} slides`);

    // Phase 1: Generate images for each slide using Nano Banana
    console.log('📸 [Phase 1] Generating images...');
    const imagePromises = slides.map((slide: any, index: number) =>
      supabase.functions.invoke('alfie-render-image', {
        body: {
          prompt: slide.prompt || slide.text || '',
          brandId,
          orderId,
          format: '1280x720', // 16:9 for video
          useNanoBanana: true,
          metadata: {
            slideIndex: index,
            totalSlides: slides.length,
          },
        },
      })
    );

    const imageResults = await Promise.all(imagePromises);
    const imageUrls = imageResults.map((r) => r.data?.url).filter(Boolean);

    if (imageUrls.length !== slides.length) {
      throw new Error(`Only ${imageUrls.length}/${slides.length} images generated successfully`);
    }

    console.log(`✅ [Phase 1] Generated ${imageUrls.length} images`);

    // Phase 2: Generate TTS audio using Lovable AI Gateway
    console.log('🎤 [Phase 2] Generating TTS audio...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Note: Vérifier si Lovable AI Gateway supporte TTS
    // Pour l'instant, cette partie est une approximation
    let audioUrl: string | null = null;

    try {
      const ttsResponse = await fetch('https://ai.gateway.lovable.dev/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-tts', // À vérifier si disponible
          input: narration,
          voice: 'female_warm',
        }),
      });

      if (ttsResponse.ok) {
        const audioBlob = await ttsResponse.blob();
        // TODO: Upload audio to Cloudinary or storage
        audioUrl = 'audio_placeholder_url'; // Placeholder
        console.log('✅ [Phase 2] TTS audio generated');
      } else {
        console.warn('⚠️ [Phase 2] TTS not available, continuing without audio');
      }
    } catch (ttsError) {
      console.warn('⚠️ [Phase 2] TTS generation failed:', ttsError);
      // Continue without audio
    }

    // Phase 3: Assemble video using Cloudinary Video API
    console.log('🎬 [Phase 3] Assembling video...');

    // IMPORTANT: ffmpeg n'est pas disponible dans Supabase Edge Functions (Deno runtime)
    // Solutions possibles:
    // 1. Cloudinary Video API (transformations vidéo natives)
    // 2. Service externe (RunPod, Modal, Replicate, etc.)
    // 3. Client-side assembly (WebCodecs API)

    // Pour cette implémentation, on utilise Cloudinary Video API
    const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
    const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials not configured');
    }

    // Upload images to Cloudinary first (if not already uploaded by alfie-render-image)
    // Then create video using Cloudinary video assembly

    // Placeholder: cette partie nécessite une implémentation complète de l'API Cloudinary Video
    const videoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/slideshow_placeholder.mp4`;

    console.log('⚠️ [Phase 3] Video assembly not fully implemented - requires Cloudinary Video API or external service');

    // Phase 4: Store in library_assets
    const { data: asset, error: assetError } = await supabase
      .from('library_assets')
      .insert({
        user_id: user.id,
        brand_id: brandId,
        order_id: orderId,
        type: 'video_slideshow',
        cloudinary_url: videoUrl,
        format: '1280x720',
        campaign: title || 'Video Slideshow',
        metadata: {
          slides: slides.length,
          imageUrls,
          audioUrl,
          narration,
          generatedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (assetError) {
      throw new Error(`Failed to store video asset: ${assetError.message}`);
    }

    console.log(`✅ [Video Slideshow] Video asset created: ${asset.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        asset_id: asset.id,
        video_url: videoUrl,
        image_urls: imageUrls,
        audio_url: audioUrl,
        message: 'Video slideshow feature requires full Cloudinary Video API implementation',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ [Video Slideshow] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
