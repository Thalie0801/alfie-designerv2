import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveBrandKit, enrichPromptWithBrand } from "../_shared/brandResolver.ts";
import { uploadBackgroundToCloudinary, buildCloudinaryTextOverlayUrl } from "../_shared/imageCompositor.ts";
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
    // Extraire le token d'authentification
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { prompt, globalStyle, slideContent, brandId, aspectRatio } = await req.json();

    // Client Supabase authentifié avec le JWT utilisateur
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

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

    const format = aspectRatio === '1:1' ? '1024x1024'
      : aspectRatio === '16:9' ? '1280x720'
      : aspectRatio === '9:16' ? '720x1280'
      : '1024x1280';

    const { data: bgData, error: bgError } = await supabaseAuth.functions.invoke(
      'alfie-render-image',
      {
        body: {
          provider: 'gemini_image',
          prompt: enrichedPrompt,
          aspectRatio,
          format,
          backgroundOnly: true,
          globalStyle,
          brand_id: brandId,
        }
      }
    );

    const payload = (bgData && typeof bgData === 'object' && 'data' in bgData) ? (bgData as any).data : bgData;
    
    if ((bgData as any)?.ok === false) {
      console.error('[Carousel Slide] Background generation error:', JSON.stringify(bgData));
      throw new Error((bgData as any)?.error || 'BACKGROUND_FUNCTION_ERROR');
    }

    const imageUrlCandidates = [
      (payload as any)?.image_urls?.[0],
      (payload as any)?.data?.image_urls?.[0],
      (payload as any)?.image_url,
      (payload as any)?.render_url,
      (payload as any)?.output_url,
    ].filter(Boolean);
    const imageUrl = imageUrlCandidates[0];

    if (bgError || !imageUrl) {
      console.error('[Carousel Slide] Background generation failed:', bgError);
      throw new Error('Background generation failed: ' + (bgError?.message || 'No image URL'));
    }

    const backgroundUrl = imageUrl as string;
    console.log('[Carousel Slide] ✅ Background generated:', backgroundUrl.substring(0, 80));

    // 4. Upload background to Cloudinary
    console.log('[Carousel Slide] Uploading background to Cloudinary...');
    const { publicId } = await uploadBackgroundToCloudinary(
      backgroundUrl,
      brandId,
      undefined // jobSetId
    );
    console.log('[Carousel Slide] ✅ Background uploaded to Cloudinary:', publicId);

    // 5. Extraire les couleurs et polices du brand kit
    const titleColor = brandSnapshot.primary_color?.replace('#', '') || '1E1E1E';
    const subtitleColor = brandSnapshot.secondary_color?.replace('#', '') || '5A5A5A';
    const titleFont = brandSnapshot.fonts?.primary || 'Arial';
    const subtitleFont = brandSnapshot.fonts?.secondary || 'Arial';

    // 6. Construire l'URL Cloudinary avec text overlays natifs
    console.log('[Carousel Slide] Building Cloudinary text overlay URL...');
    const composedUrl = buildCloudinaryTextOverlayUrl(publicId, {
      title: slideContent.title,
      subtitle: slideContent.subtitle,
      titleColor,
      subtitleColor,
      titleSize: 64,
      subtitleSize: 28,
      titleFont,
      subtitleFont,
      titleWeight: 'bold',
      subtitleWeight: 'normal'
    });

    console.log('[Carousel Slide] ✅ Final URL with text overlay:', composedUrl.substring(0, 100));

    // 7. Enregistrer dans media_generations
    const { data: generation } = await supabaseAdmin
      .from('media_generations')
      .insert({
        user_id: (await supabaseAuth.auth.getUser()).data.user?.id,
        brand_id: brandId,
        type: 'image',
        modality: 'carousel_slide',
        provider_id: 'cloudinary_text_overlay',
        prompt: `${prompt} - Slide ${slideContent.type}`,
        output_url: composedUrl,
        render_url: composedUrl,
        status: 'completed',
        cost_woofs: 1,
        params_json: { slideType: slideContent.type, aspectRatio, cloudinaryPublicId: publicId }
      })
      .select()
      .single();

    console.log('[Carousel Slide] ✅ Saved to media_generations:', generation?.id);

    // 8. Retourner l'URL finale
    return new Response(JSON.stringify({ 
      image_url: composedUrl,
      generation_id: generation?.id || `carousel-${Date.now()}`,
      cloudinary_public_id: publicId
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
