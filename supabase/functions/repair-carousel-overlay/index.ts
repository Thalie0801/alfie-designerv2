import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { buildCarouselSlideUrl } from "../_shared/cloudinary.ts";

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: slide, error } = await supabase
      .from('library_assets')
      .select('*')
      .eq('id', slideId)
      .single();

    if (error || !slide) {
      return new Response(
        JSON.stringify({ error: 'Slide not found', slide_id: slideId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get base public_id from stored data (no extraction needed with SDK)
    const publicId = slide.cloudinary_public_id || slide.metadata?.original_public_id;

    if (!publicId || publicId.includes('l_text:')) {
      return new Response(
        JSON.stringify({ 
          error: 'No base public_id found - slide needs regeneration',
          slide_id: slideId,
          hint: 'This slide was created before SDK migration. Please regenerate the carousel.'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!slide.text_json?.title && !slide.text_json?.subtitle) {
      return new Response(
        JSON.stringify({ error: 'No text content to overlay', slide_id: slideId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch brand data
    const { data: brandData } = await supabase
      .from('brands')
      .select('palette, fonts')
      .eq('id', slide.brand_id)
      .single();

    const palette = brandData?.palette || [];
    const fonts = brandData?.fonts || {};
    const primaryColor = (palette[0]?.color || palette[0] || 'ffffff').replace('#', '');
    const secondaryColor = (palette[1]?.color || palette[1] || 'eeeeee').replace('#', '');

    // Build new overlay URL using SDK
    const newCloudinaryUrl = buildCarouselSlideUrl({
      publicId,
      title: slide.text_json?.title,
      subtitle: slide.text_json?.subtitle,
      bullets: slide.text_json?.bullets,
      cta: slide.text_json?.cta || slide.text_json?.alt,
      colors: { title: primaryColor, subtitle: secondaryColor },
      fonts: { title: fonts.primary || 'Inter', subtitle: fonts.secondary || 'Inter' }
    });

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
      throw new Error(`Failed to update slide: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, cloudinary_url: newCloudinaryUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[repair-carousel-overlay] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
