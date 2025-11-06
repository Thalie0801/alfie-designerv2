import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  uploadWithRichMetadata, 
  uploadTextAsRaw, 
  buildCloudinaryTextOverlayUrl 
} from "../_shared/cloudinaryUploader.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlideRequest {
  prompt: string;
  globalStyle: string;
  slideContent: {
    title: string;
    subtitle?: string;
    bullets?: string[];
    alt: string;
  };
  brandId: string;
  orderId: string;
  carouselId: string;
  slideIndex: number;
  totalSlides: number;
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  textVersion: number;
  renderVersion: number;
  campaign: string;
  language?: string;
}

serve(async (req) => {
  console.log('[alfie-render-carousel-slide] Request received');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const params: SlideRequest = await req.json();
    const {
      prompt,
      globalStyle,
      slideContent,
      brandId,
      orderId,
      carouselId,
      slideIndex,
      totalSlides,
      aspectRatio,
      textVersion,
      renderVersion,
      campaign,
      language = 'FR'
    } = params;

    console.log('[Render Slide] Starting generation:', {
      slideIndex: slideIndex + 1,
      totalSlides,
      carouselId
    });

    // 1. Upload texte JSON en RAW Cloudinary
    console.log('[Render Slide] Step 1/4: Uploading text JSON to Cloudinary RAW...');
    
    const textPublicId = await uploadTextAsRaw(
      {
        title: slideContent.title,
        subtitle: slideContent.subtitle || '',
        bullets: slideContent.bullets || [],
        alt: slideContent.alt
      },
      {
        brandId,
        campaign,
        carouselId,
        textVersion,
        language
      }
    );

    console.log('[Render Slide] Text uploaded to Cloudinary:', textPublicId);

    // 2. Générer background via Nano Banana avec negative prompt anti-collage
    console.log('[Render Slide] Step 2/4: Generating background...');
    
    const enrichedPrompt = `${globalStyle}. ${prompt}. Background only, no text, clean and professional.`;
    const negativePrompt = 'collage, grid, panels, multiple images, split screen, text, typography, letters';
    
    const format = aspectRatio === '1:1' ? '1024x1024'
      : aspectRatio === '16:9' ? '1280x720'
      : aspectRatio === '9:16' ? '720x1280'
      : aspectRatio === '4:5' ? '1024x1280'
      : '1024x1024';

    const { data: bgData, error: bgError } = await supabaseClient.functions.invoke('alfie-render-image', {
      body: {
        provider: 'gemini_image',
        prompt: enrichedPrompt,
        negativePrompt,
        format,
        backgroundOnly: true,
        brand_id: brandId,
        cost_woofs: 0, // Pas de coût pour background intermédiaire
        globalStyle,
        slideIndex,
        totalSlides
      }
    });

    if (bgError) {
      console.error('[Render Slide] Background generation error:', bgError);
      throw new Error(`Background generation failed: ${bgError.message}`);
    }

    const payload = (bgData && typeof bgData === 'object' && 'data' in bgData) ? (bgData as any).data : bgData;
    const backgroundUrl = payload?.image_urls?.[0];

    if (!backgroundUrl) {
      console.error('[Render Slide] No background URL in response:', payload);
      throw new Error('Background generation failed - no URL');
    }

    console.log('[Render Slide] Background generated (base64 length:', backgroundUrl.substring(0, 100), ')');

    // 3. Upload slide avec métadonnées enrichies
    console.log('[Render Slide] Step 3/4: Uploading slide to Cloudinary...');
    
    // Récupérer brand kit pour les couleurs
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: brandData } = await supabaseAdmin
      .from('brands')
      .select('palette, fonts')
      .eq('id', brandId)
      .single();

    const palette = brandData?.palette || [];
    const fonts = brandData?.fonts || {};
    const primaryColor = (palette[0]?.color || palette[0] || '1E1E1E').replace('#', '');
    const secondaryColor = (palette[1]?.color || palette[1] || '5A5A5A').replace('#', '');

    const uploadResult = await uploadWithRichMetadata(
      backgroundUrl,
      {
        brandId,
        campaign,
        orderId,
        assetId: carouselId,
        type: 'carousel_slide',
        format: aspectRatio,
        language,
        slideIndex,
        textPublicId,
        renderVersion,
        textVersion,
        alt: slideContent.alt
      }
    );

    console.log('[Render Slide] Uploaded to Cloudinary:', {
      publicId: uploadResult.publicId,
      url: uploadResult.secureUrl
    });

    // 4. Construire URL finale avec text overlays robustes
    console.log('[Render Slide] Step 4/4: Building final URL with text overlays...');
    
    const cloudinaryUrl = buildCloudinaryTextOverlayUrl(uploadResult.publicId, {
      title: slideContent.title,
      subtitle: slideContent.subtitle || '',
      titleColor: primaryColor,
      subtitleColor: secondaryColor,
      titleSize: 64,
      subtitleSize: 32,
      titleFont: fonts.primary || 'Arial',
      subtitleFont: fonts.secondary || 'Arial',
      titleWeight: 'bold',
      subtitleWeight: 'normal',
      width: 960,
      lineSpacing: 10
    });

    console.log('[Render Slide] Final URL generated:', cloudinaryUrl.substring(0, 150));

    // 5. Garantir que la dérivée existe sur Cloudinary (Strict Transformations)
    console.log('[Render Slide] Step 5/6: Ensuring derivative exists on Cloudinary...');
    
    const { 
      ensureDerived, 
      buildTextOverlayTransform 
    } = await import('../_shared/cloudinaryUploader.ts');
    
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    
    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('[Render Slide] Cloudinary credentials missing, skipping eager generation');
    } else {
      try {
        const transformString = buildTextOverlayTransform({
          title: slideContent.title,
          subtitle: slideContent.subtitle || '',
          titleColor: primaryColor,
          subtitleColor: secondaryColor,
          titleSize: 64,
          subtitleSize: 32,
          titleFont: fonts.primary || 'Arial',
          subtitleFont: fonts.secondary || 'Arial',
          titleWeight: 'bold',
          subtitleWeight: 'normal',
          width: 960,
          lineSpacing: 10
        });
        
        const explicitResult = await ensureDerived(
          cloudName,
          apiKey,
          apiSecret,
          uploadResult.publicId,
          transformString
        );
        
        console.log('[Render Slide] Derivative generated:', {
          publicId: explicitResult.public_id,
          eager: explicitResult.eager?.length || 0
        });
      } catch (eagerError: any) {
        console.error('[Render Slide] Eager generation failed:', eagerError.message);
        // Continue anyway - l'URL on-the-fly pourrait fonctionner
      }
    }

    // 6. Stocker dans library_assets
    const { error: insertError } = await supabaseAdmin
      .from('library_assets')
      .insert({
        user_id: user.id,
        brand_id: brandId,
        order_id: orderId,
        carousel_id: carouselId,
        type: 'carousel_slide',
        slide_index: slideIndex,
        format: aspectRatio,
        campaign,
        cloudinary_url: cloudinaryUrl,
        cloudinary_public_id: uploadResult.publicId,
        text_json: {
          title: slideContent.title,
          subtitle: slideContent.subtitle || '',
          bullets: slideContent.bullets || [],
          alt: slideContent.alt,
          text_public_id: textPublicId,
          text_version: textVersion,
          render_version: renderVersion
        },
        metadata: {
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format
        }
      });

    if (insertError) {
      console.error('[Render Slide] Database insert error:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      cloudinary_url: cloudinaryUrl,
      cloudinary_public_id: uploadResult.publicId,
      text_public_id: textPublicId,
      slide_metadata: {
        title: slideContent.title,
        subtitle: slideContent.subtitle,
        slideIndex,
        renderVersion,
        textVersion
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
