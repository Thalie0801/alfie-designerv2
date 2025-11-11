import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Unauthorized');

    const userId = user.id;
    console.log(`🎨 [Carousel Bulk] Authenticated user: ${userId}`);

    const { carousels, brandId, orderId, globalStyle, textVersion = 'v1' } = await req.json();

    if (!carousels || !Array.isArray(carousels)) {
      throw new Error('Carousels array is required');
    }

    console.log(`🎨 [Carousel Bulk] Generating ${carousels.length} carousels`);

    const results = [];

    // Process each carousel
    for (const carousel of carousels) {
      const carouselId = carousel.id || crypto.randomUUID();
      const slides = [];

      console.log(`📚 [Carousel ${carouselId}] Generating ${carousel.slides.length} slides`);

      // Generate each slide using alfie-render-carousel-slide
      for (let slideIndex = 0; slideIndex < carousel.slides.length; slideIndex++) {
        const slide = carousel.slides[slideIndex];

        console.log(`🔨 [Slide ${slideIndex + 1}/${carousel.slides.length}] Rendering...`);

        // Call alfie-render-carousel-slide for each slide
        const { data: slideData, error: slideError } = await supabaseAdmin.functions.invoke(
          'alfie-render-carousel-slide',
          {
            body: {
              userId,
              slideContent: slide,
              globalStyle: globalStyle || carousel.globalStyle || {},
              brandId,
              orderId,
              carouselId,
              slideIndex,
              totalSlides: carousel.slides.length,
              aspectRatio: carousel.aspectRatio || '4:5',
              textVersion,
              renderVersion: 'v1',
              context: 'bulk',
            },
          }
        );

        if (slideError) {
          console.error(`❌ [Slide ${slideIndex + 1}] Error:`, slideError);
          throw new Error(`Slide ${slideIndex + 1} failed: ${slideError.message}`);
        }

        slides.push(slideData);
        console.log(`✅ [Slide ${slideIndex + 1}] Generated: ${slideData.cloudinaryUrl}`);
      }

      results.push({
        carouselId,
        slides,
        totalSlides: slides.length,
      });

      console.log(`✅ [Carousel ${carouselId}] Complete with ${slides.length} slides`);
    }

    console.log(`✅ [Carousel Bulk] All ${carousels.length} carousels generated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        carousels: results,
        total: carousels.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ [Carousel Bulk] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
