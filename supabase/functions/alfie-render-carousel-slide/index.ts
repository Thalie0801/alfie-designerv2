import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveBrandKit, enrichPromptWithBrand } from "../_shared/brandResolver.ts";
import { renderSlideToSVG } from "../_shared/slideRenderer.ts";
import { compositeSlide } from "../_shared/imageCompositor.ts";
import { SLIDE_TEMPLATES } from "../_shared/slideTemplates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface SlideContent {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
  title: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  cta?: string;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
  badge?: string;
  kpis?: Array<{ label: string; delta: string }>;
}

serve(async (req) => {
  console.log('[alfie-render-carousel-slide] Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, globalStyle, slideContent, brandId, aspectRatio } = await req.json();

    if (!prompt || !globalStyle || !slideContent || !brandId) {
      throw new Error('Missing required parameters');
    }

    console.log('[Carousel Slide] Processing:', {
      slideType: slideContent.type,
      aspectRatio,
      brandId
    });

    // 1. Résoudre le brand kit
    const brandSnapshot = await resolveBrandKit(brandId);
    console.log('[Carousel Slide] Brand resolved:', {
      hasLogo: !!brandSnapshot.logo_url,
      hasPrimaryColor: !!brandSnapshot.primary_color
    });

    // 2. Enrichir le prompt avec les couleurs de la marque
    const enrichedPrompt = enrichPromptWithBrand(
      `${globalStyle}. ${prompt}. Aspect ratio ${aspectRatio}.`,
      brandSnapshot
    );

    console.log('[Carousel Slide] Enriched prompt:', enrichedPrompt.substring(0, 150));

    // 3. Générer le fond via alfie-render-image
    console.log('[Carousel Slide] Calling alfie-render-image...');
    const { data: bgData, error: bgError } = await supabaseAdmin.functions.invoke(
      'alfie-render-image',
      {
        body: {
          prompt: enrichedPrompt,
          aspectRatio,
          brandId
        }
      }
    );

    if (bgError || !bgData?.image_urls?.[0]) {
      console.error('[Carousel Slide] Background generation failed:', bgError);
      throw new Error('Background generation failed: ' + (bgError?.message || 'No image URL'));
    }

    const backgroundUrl = bgData.image_urls[0];
    console.log('[Carousel Slide] ✅ Background generated');

    // 4. Sélectionner le template approprié
    const template = SLIDE_TEMPLATES[slideContent.type] || SLIDE_TEMPLATES.hero;
    console.log('[Carousel Slide] Using template:', template.type);

    // 5. Générer l'overlay SVG
    console.log('[Carousel Slide] Generating SVG overlay...');
    const svgOverlay = await renderSlideToSVG(slideContent, template, brandSnapshot);
    console.log('[Carousel Slide] ✅ SVG overlay generated:', svgOverlay.length, 'chars');

    // 6. Composer l'image finale via Cloudinary
    console.log('[Carousel Slide] Composing final image...');
    const { url: composedUrl, bgPublicId, svgPublicId } = await compositeSlide(
      backgroundUrl,
      svgOverlay,
      undefined, // jobSetId - not needed here
      brandId,
      {
        primaryColor: brandSnapshot.primary_color,
        secondaryColor: brandSnapshot.secondary_color,
        tintStrength: 40 // Subtle tint pour cohérence
      }
    );

    console.log('[Carousel Slide] ✅ Final composition complete');

    // 7. Retourner l'URL finale
    return new Response(JSON.stringify({ 
      image_url: composedUrl,
      generation_id: bgData.generation_id || `carousel-${Date.now()}`,
      debug: {
        bgPublicId,
        svgPublicId,
        slideType: slideContent.type
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[alfie-render-carousel-slide] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
