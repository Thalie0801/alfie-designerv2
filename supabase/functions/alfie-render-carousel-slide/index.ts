import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { uploadTextAsRaw } from "../_shared/cloudinaryUploader.ts";

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
  aspectRatio: string; // Allow any string, we'll normalize it
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
    let {
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

    // ✅ Use service role client pour toutes les opérations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ Fallback: si userId manquant, tenter de le déduire depuis orderId
    if (!userId && orderId) {
      console.log(`[alfie-render-carousel-slide] ⚠️ userId missing, attempting to deduce from orderId: ${orderId}`);
      
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        console.error('[alfie-render-carousel-slide] ❌ Cannot deduce userId from orderId:', orderError);
        return new Response(
          JSON.stringify({ error: 'userId is required and could not be deduced from orderId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = order.user_id;
      console.log(`[alfie-render-carousel-slide] ✅ Deduced userId: ${userId}`);
    }

    // ✅ Validation finale: userId requis
    if (!userId) {
      console.error('[alfie-render-carousel-slide] ❌ Missing userId in request and no orderId to deduce from');
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize aspectRatio (handle pixel formats like "1080x1350")
    let normalizedAspectRatio = aspectRatio;
    if (aspectRatio && aspectRatio.includes('x')) {
      // Convert pixel format to ratio
      normalizedAspectRatio = aspectRatio === '1080x1350' ? '4:5' :
                               aspectRatio === '1080x1920' ? '9:16' :
                               aspectRatio === '1920x1080' ? '16:9' :
                               aspectRatio === '1080x1080' ? '1:1' : '4:5';
      console.log(`[alfie-render-carousel-slide] Normalized aspectRatio from ${aspectRatio} to ${normalizedAspectRatio}`);
    }

    console.log(`[alfie-render-carousel-slide] Processing slide ${slideIndex + 1}/${totalSlides} for user: ${userId}, carousel: ${carouselId}`);

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
    
    const [width, height] = normalizedAspectRatio === '1:1' ? [1024, 1024]
      : normalizedAspectRatio === '16:9' ? [1280, 720]
      : normalizedAspectRatio === '9:16' ? [720, 1280]
      : normalizedAspectRatio === '4:5' ? [1024, 1280]
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

    // ✅ Handle rate limit (429)
    if (aiResponse.status === 429) {
      console.error('[Render Slide] ⏱️ Rate limit exceeded');
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Handle insufficient credits (402)
    if (aiResponse.status === 402) {
      console.error('[Render Slide] 💳 Insufficient credits');
      return new Response(
        JSON.stringify({ error: 'Insufficient credits for AI generation' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Render Slide] ❌ AI error:', aiResponse.status, errorText);
      throw new Error(`Background generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const backgroundUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!backgroundUrl) {
      console.error('[Render Slide] ❌ No background URL in AI response. Full response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: 'No image generated by AI API', details: aiData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Render Slide] Background generated:', backgroundUrl.substring(0, 100));

    // 3. Upload slide avec métadonnées enrichies via centralized /cloudinary function
    console.log('[Render Slide] Step 3/4: Uploading slide to Cloudinary via centralized function...');
    
    // Récupérer brand kit pour les couleurs
    const { data: brandData } = await supabaseAdmin
      .from('brands')
      .select('palette, fonts')
      .eq('id', brandId)
      .single();

    const palette = brandData?.palette || [];
    const fonts = brandData?.fonts || {};
    const primaryColor = (palette[0]?.color || palette[0] || 'ffffff').replace('#', '');
    const secondaryColor = (palette[1]?.color || palette[1] || 'eeeeee').replace('#', '');

    // ✅ Phase 4: New naming convention: alfie/{brandId}/{campaignId}/slides/slide_XX
    const slidePublicId = `slide_${String(slideIndex + 1).padStart(2, '0')}`;
    const slideFolder = `alfie/${brandId}/${carouselId}/slides`;

    // ✅ Phase 3: Use centralized /cloudinary edge function for upload
    const { data: uploadData, error: uploadError } = await supabaseAdmin.functions.invoke('cloudinary', {
      body: {
        action: 'upload',
        params: {
          file: backgroundUrl,
          folder: slideFolder,
          public_id: slidePublicId,
          resource_type: 'image',
          tags: [brandId, carouselId, 'carousel_slide', campaign, 'alfie'],
          context: {
            brand: brandId,
            carousel: carouselId,
            campaign: campaign,
            slide_index: String(slideIndex),
            render_version: String(renderVersion),
            text_version: String(textVersion)
          }
        }
      }
    });

    if (uploadError || !uploadData) {
      console.error('[Render Slide] ❌ Cloudinary upload error:', uploadError);
      throw new Error(`Failed to upload to Cloudinary: ${uploadError?.message || 'Unknown error'}`);
    }

    const uploadResult = {
      publicId: uploadData.public_id,
      secureUrl: uploadData.secure_url,
      width: uploadData.width,
      height: uploadData.height,
      format: uploadData.format
    };

    console.log('[Render Slide] ✅ Uploaded to Cloudinary:', {
      publicId: uploadResult.publicId,
      secureUrl: uploadResult.secureUrl.substring(0, 100)
    });

    // ✅ Phase 2: Store only BASE URL without overlays (SDK will regenerate client-side)
    console.log('[Render Slide] Step 4/4: Storing base URL (overlays generated client-side)...');
    
    const cloudinaryUrl = uploadResult.secureUrl; // ✅ Base URL ONLY, no overlays

    console.log('[Render Slide] ✅ Base URL stored:', cloudinaryUrl.substring(0, 150));

    // 6. ✅ Stocker dans library_assets avec idempotence check
    console.log('[Render Slide] Step 6/6: Checking for existing asset and saving to library_assets...');
    
    // Check if asset already exists (idempotence)
    const { data: existingAsset } = await supabaseAdmin
      .from('library_assets')
      .select('id, cloudinary_url, cloudinary_public_id')
      .eq('order_id', orderId)
      .eq('carousel_id', carouselId)
      .eq('slide_index', slideIndex)
      .maybeSingle();

    if (existingAsset) {
      console.log(`[Render Slide] ♻️ Asset already exists (idempotent): ${existingAsset.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          cloudinary_url: existingAsset.cloudinary_url,
          cloudinary_public_id: existingAsset.cloudinary_public_id,
          text_public_id: textPublicId,
          slide_metadata: {
            title: slideContent.title,
            subtitle: slideContent.subtitle,
            slideIndex,
            renderVersion,
            textVersion
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ✅ Phase 2: Insert with BASE URL only (no overlays) - SDK regenerates client-side
    const { error: insertError } = await supabaseAdmin
      .from('library_assets')
      .insert({
        user_id: userId,
        brand_id: brandId,
        order_id: orderId,
        carousel_id: carouselId,
        type: 'carousel_slide',
        slide_index: slideIndex,
        format: normalizedAspectRatio,
        campaign,
        cloudinary_url: cloudinaryUrl, // ✅ Base URL ONLY (no overlays)
        cloudinary_public_id: uploadResult.publicId, // ✅ Clean base public_id for SDK regeneration
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
          format: uploadResult.format,
          cloudinary_base_url: uploadResult.secureUrl, // ✅ Same as cloudinary_url (base only)
          original_public_id: uploadResult.publicId // ✅ Backup reference
        }
      });
    
    console.log('[Render Slide] ✅ Saved to library_assets:', { 
      orderId, 
      slideIndex, 
      userId, 
      publicId: uploadResult.publicId,
      baseUrl: cloudinaryUrl.substring(0, 100)
    });

    if (insertError) {
      console.error('[Render Slide] ❌ Database insert error:', insertError);
      throw new Error(`Failed to save slide: ${insertError.message}`);
    }
    
    console.log('[Render Slide] ✅ Saved to library_assets:', { orderId, slideIndex, userId, publicId: uploadResult.publicId });

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
