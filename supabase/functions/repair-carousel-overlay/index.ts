import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  buildTextOverlayTransform, 
  ensureDerived 
} from "../_shared/cloudinaryUploader.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slideId } = await req.json();
    
    if (!slideId) {
      return new Response(
        JSON.stringify({ error: 'slideId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[repair-carousel-overlay] Repairing slide:', slideId);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch slide data
    const { data: slide, error: slideError } = await supabase
      .from('library_assets')
      .select('cloudinary_public_id, cloudinary_url, text_json, metadata, brand_id, order_id, user_id')
      .eq('id', slideId)
      .single();

    if (slideError || !slide) {
      console.error('[repair-carousel-overlay] Slide not found:', slideError);
      return new Response(
        JSON.stringify({ error: 'Slide not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper to extract public_id from Cloudinary URL
    const extractPublicIdFromUrl = (url?: string | null): string | null => {
      if (!url) return null;
      try {
        // Accept both full URLs and already-sliced paths
        const afterUpload = url.includes('/upload/') ? url.split('/upload/')[1] : url;
        if (!afterUpload) return null;

        // Remove query and extension early
        const noQuery = afterUpload.split('?')[0];
        const noExt = noQuery.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
        const parts = noExt.split('/').filter(Boolean);

        // Strategy A: If we have our folder root, always start from there
        const brandsIdx = parts.indexOf('brands');
        if (brandsIdx >= 0) {
          const fromBrands = parts.slice(brandsIdx).join('/');
          const cleaned = fromBrands.replace(/^(?:v\d+\/)*/i, ''); // drop any leading version tokens
          console.log('[repair-carousel-overlay] Extracted via brands root:', cleaned);
          return cleaned;
        }

        // Strategy B: If a version token exists (v123...), drop it and everything before it
        const vIndex = parts.findIndex(p => /^v\d+$/i.test(p));
        if (vIndex >= 0 && vIndex + 1 < parts.length) {
          const cleaned = parts.slice(vIndex + 1).join('/');
          console.log('[repair-carousel-overlay] Extracted via version token:', cleaned);
          return cleaned;
        }

        // Strategy C: Skip transformation-like segments at the start (contain ':' or ',' or look like x_xxx)
        let start = 0;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.includes(':') || part.includes(',') || /^[a-z]_/.test(part)) continue; // transform
          if (/^v\d+$/i.test(part)) continue; // version
          start = i; break;
        }
        if (start > 0 && start < parts.length) {
          const cleaned = parts.slice(start).join('/').replace(/^(?:v\d+\/)*/i, '');
          console.log('[repair-carousel-overlay] Extracted via transform-skip:', cleaned);
          return cleaned;
        }

        // Fallback: return last segments as best-effort
        const fallback = parts.slice(-4).join('/');
        console.warn('[repair-carousel-overlay] Fallback public_id used:', fallback);
        return fallback || null;
      } catch (err) {
        console.warn('[repair-carousel-overlay] Failed to extract public_id:', err);
        return null;
      }
    };

    // Try to infer cloudinary_public_id if missing
    let publicId = slide.cloudinary_public_id;
    
    if (!publicId) {
      console.log('[repair-carousel-overlay] cloudinary_public_id missing, attempting to infer...');
      
      // Try multiple sources in priority order
      const candidateUrls = [
        slide.cloudinary_url,
        slide.metadata?.cloudinary_base_url,
        slide.metadata?.base_url,
        slide.metadata?.source_url,
        slide.metadata?.original_url
      ];
      
      for (const url of candidateUrls) {
        const inferred = extractPublicIdFromUrl(url);
        if (inferred) {
          publicId = inferred;
          console.log(`[repair-carousel-overlay] ✅ Inferred public_id from URL: ${inferred}`);
          
          // Update database with inferred public_id
          await supabase
            .from('library_assets')
            .update({ cloudinary_public_id: publicId })
            .eq('id', slideId);
          
          break;
        }
      }
      
      // If still no public_id after inference, fail
      if (!publicId) {
        console.error('[repair-carousel-overlay] Cannot infer cloudinary_public_id from any URL');
        return new Response(
          JSON.stringify({ 
            error: 'Cannot infer Cloudinary public_id from URLs - slide may need manual repair',
            slide_id: slideId,
            checked_urls: candidateUrls.filter(Boolean).length
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!slide.text_json?.title && !slide.text_json?.subtitle) {
      console.log('[repair-carousel-overlay] No text to overlay for slide:', slideId);
      return new Response(
        JSON.stringify({ 
          error: 'No text content to overlay',
          slide_id: slideId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch brand palette and fonts
    const { data: brandData } = await supabase
      .from('brands')
      .select('palette, fonts')
      .eq('id', slide.brand_id)
      .single();

    const palette = brandData?.palette || [];
    const fonts = brandData?.fonts || {};
    const primaryColor = (palette[0]?.color || palette[0] || '1E1E1E').replace('#', '');
    const secondaryColor = (palette[1]?.color || palette[1] || '5A5A5A').replace('#', '');

    // Build correct overlay URL
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials not configured');
    }

    const transformString = buildTextOverlayTransform({
      title: slide.text_json?.title || '',
      subtitle: slide.text_json?.subtitle || '',
      bullets: slide.text_json?.bullets || [],
      cta: slide.text_json?.cta || slide.text_json?.alt || '',
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

    // Generate derived image (explicit) with robust error mapping
    console.log('[repair-carousel-overlay] Generating derivative for public_id:', publicId);
    try {
      await ensureDerived(
        cloudName!,
        apiKey!,
        apiSecret!,
        publicId!,
        transformString
      );
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.error('[repair-carousel-overlay] ensureDerived failed:', msg);
      if (msg.includes('Resource not found')) {
        return new Response(
          JSON.stringify({
            error: 'Cloudinary source not found for this slide',
            public_id: publicId,
            slide_id: slideId
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw e;
    }

    console.log('[repair-carousel-overlay] Derivative generated');

    // Build new URL using resolved public_id
    const newCloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${publicId}.png`;
    console.log('[repair-carousel-overlay] Generated new URL:', newCloudinaryUrl.substring(0, 150) + '...');

    // Update database
    const { error: updateError } = await supabase
      .from('library_assets')
      .update({
        cloudinary_url: newCloudinaryUrl,
        metadata: {
          ...slide.metadata,
          overlay_generated: true,
          repaired_at: new Date().toISOString()
        }
      })
      .eq('id', slideId);

    if (updateError) {
      console.error('[repair-carousel-overlay] Update error:', updateError);
      throw new Error(`Failed to update slide: ${updateError.message}`);
    }

    console.log('[repair-carousel-overlay] ✅ Slide repaired successfully');

    return new Response(
      JSON.stringify({
        success: true,
        cloudinary_url: newCloudinaryUrl,
        slide_id: slideId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[repair-carousel-overlay] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
