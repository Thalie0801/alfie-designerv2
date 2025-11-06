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
  userId: string; // ✅ Required from worker
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
    const params: SlideRequest = await req.json();
    const {
      userId,
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

    // ✅ Validation: userId requis
    if (!userId) {
      console.error('[alfie-render-carousel-slide] Missing userId in request');
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ Use service role client pour toutes les opérations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // 2. ✅ Générer background directement via Lovable AI (pas de JWT requis)
    console.log('[Render Slide] Step 2/4: Generating background with Lovable AI...');
    
    const enrichedPrompt = `${globalStyle}. ${prompt}. Background only, no text, clean and professional. High quality, detailed, vibrant colors.`;
    
    const [width, height] = aspectRatio === '1:1' ? [1024, 1024]
      : aspectRatio === '16:9' ? [1280, 720]
      : aspectRatio === '9:16' ? [720, 1280]
      : aspectRatio === '4:5' ? [1024, 1280]
      : [1024, 1024];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: enrichedPrompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Render Slide] AI error:', aiResponse.status, errorText);
      throw new Error(`Background generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const backgroundUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!backgroundUrl) {
      console.error('[Render Slide] No background URL in AI response:', aiData);
      throw new Error('Background generation failed - no URL');
    }

    console.log('[Render Slide] Background generated:', backgroundUrl.substring(0, 100));

    // 3. Upload slide avec métadonnées enrichies
    console.log('[Render Slide] Step 3/4: Uploading slide to Cloudinary...');
    
    // Récupérer brand kit pour les couleurs
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

    // 6. ✅ Stocker dans library_assets avec userId du body
    console.log('[Render Slide] Step 6/6: Saving to library_assets...');
    
    const { error: insertError } = await supabaseAdmin
      .from('library_assets')
      .insert({
        user_id: userId, // ✅ Utiliser userId du body
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
      throw new Error(`Failed to save slide: ${insertError.message}`);
    }
    
    console.log('[Render Slide] ✅ Saved to library_assets:', { orderId, slideIndex, userId });

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
