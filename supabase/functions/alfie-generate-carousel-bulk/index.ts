import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { uploadBackgroundToCloudinary, buildCloudinaryTextOverlayUrl } from "../_shared/imageCompositor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface SlideText {
  title: string;
  subtitle: string;
}

interface CarouselRequest {
  num_carousels: number;
  num_slides_per_carousel: number;
  theme: string;
  brand_id: string;
  campaign_name: string;
  text_option: 'alfie' | 'excel';
  excel_data?: SlideText[][];
  global_style?: string;
  aspect_ratio?: string;
}

serve(async (req) => {
  console.log('[alfie-generate-carousel-bulk] Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const params: CarouselRequest = await req.json();
    const {
      num_carousels,
      num_slides_per_carousel,
      theme,
      brand_id,
      campaign_name,
      text_option,
      excel_data,
      global_style = "Professional, clean, modern design",
      aspect_ratio = "1:1"
    } = params;

    console.log('[Bulk Carousel] Starting generation:', {
      num_carousels,
      num_slides_per_carousel,
      theme,
      brand_id
    });

    // Fetch brand kit
    const { data: brandData } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .single();

    if (!brandData) throw new Error('Brand not found');

    const palette = brandData.palette || [];
    const titleColor = (palette[0]?.color || palette[0] || '1E1E1E').replace('#', '');
    const subtitleColor = (palette[1]?.color || palette[1] || '5A5A5A').replace('#', '');
    const fonts = brandData.fonts || {};
    const titleFont = fonts.primary || 'Arial';
    const subtitleFont = fonts.secondary || 'Arial';

    const results = [];
    const concurrency = 3; // Process 3 carousels at a time

    // Process carousels in batches
    for (let i = 0; i < num_carousels; i += concurrency) {
      const batch = [];
      
      for (let j = 0; j < concurrency && (i + j) < num_carousels; j++) {
        const carouselIndex = i + j;
        batch.push(generateCarousel({
          carouselIndex,
          num_slides_per_carousel,
          theme,
          brand_id,
          campaign_name,
          text_option,
          excel_data: excel_data?.[carouselIndex],
          global_style,
          aspect_ratio,
          user_id: user.id,
          supabaseAuth,
          brandData: {
            titleColor,
            subtitleColor,
            titleFont,
            subtitleFont
          }
        }));
      }

      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults.map((r, idx) => ({
        carousel_index: i + idx,
        status: r.status,
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason.message : null
      })));

      // Small pause between batches
      if (i + concurrency < num_carousels) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      carousels: results,
      total: num_carousels,
      successful: results.filter(r => r.status === 'fulfilled').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[alfie-generate-carousel-bulk] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateCarousel(params: any) {
  const {
    carouselIndex,
    num_slides_per_carousel,
    theme,
    brand_id,
    campaign_name,
    text_option,
    excel_data,
    global_style,
    aspect_ratio,
    user_id,
    supabaseAuth,
    brandData
  } = params;

  console.log(`[Carousel ${carouselIndex + 1}] 🚀 Starting generation:`, {
    slides: num_slides_per_carousel,
    theme: theme.substring(0, 100),
    aspect_ratio
  });

  // 1. Generate background via Nano Banana
  console.log(`[Carousel ${carouselIndex + 1}] Step 1/4: Generating background...`);
  
  const bgPrompt = `${global_style}. ${theme}. Background only, no text, clean and professional.`;
  
  const format = aspect_ratio === '1:1' ? '1024x1024'
    : aspect_ratio === '16:9' ? '1280x720'
    : aspect_ratio === '9:16' ? '720x1280'
    : '1024x1024';

  console.log(`[Carousel ${carouselIndex + 1}] Background prompt:`, bgPrompt.substring(0, 100));
  console.log(`[Carousel ${carouselIndex + 1}] Format:`, format);

  const { data: bgData, error: bgError } = await supabaseAuth.functions.invoke('alfie-render-image', {
    body: {
      provider: 'gemini_image',
      prompt: bgPrompt,
      format,
      backgroundOnly: true,
      brand_id
    }
  });

  if (bgError) {
    console.error(`[Carousel ${carouselIndex + 1}] Background generation error:`, bgError);
    throw new Error(`Carousel ${carouselIndex + 1}: Background generation failed - ${bgError.message}`);
  }

  const payload = (bgData && typeof bgData === 'object' && 'data' in bgData) ? (bgData as any).data : bgData;
  const backgroundUrl = payload?.image_urls?.[0] || payload?.image_url || payload?.render_url;

  if (!backgroundUrl) {
    console.error(`[Carousel ${carouselIndex + 1}] No background URL in response:`, payload);
    throw new Error(`Carousel ${carouselIndex + 1}: Background generation failed - no URL`);
  }

  console.log(`[Carousel ${carouselIndex + 1}] ✅ Background generated:`, backgroundUrl.substring(0, 80));

  // 2. Upload background to Cloudinary
  console.log(`[Carousel ${carouselIndex + 1}] Step 2/4: Uploading to Cloudinary...`);
  
  const { publicId: bgPublicId } = await uploadBackgroundToCloudinary(
    backgroundUrl,
    brand_id,
    `carousel_${String(carouselIndex + 1).padStart(2, '0')}`
  );

  console.log(`[Carousel ${carouselIndex + 1}] ✅ Uploaded to Cloudinary:`, bgPublicId);

  // 3. Store background in Supabase storage
  console.log(`[Carousel ${carouselIndex + 1}] Step 3/4: Storing in Supabase...`);
  
  const bgPath = `clients/${user_id}/${campaign_name}/carousel_${String(carouselIndex + 1).padStart(2, '0')}/backgrounds/bg_001.png`;
  const bgBlob = await fetch(backgroundUrl).then(r => r.blob());
  
  await supabaseAdmin.storage
    .from('media-generations')
    .upload(bgPath, bgBlob, { contentType: 'image/png', upsert: true });

  const { data: { publicUrl: bgStorageUrl } } = supabaseAdmin.storage
    .from('media-generations')
    .getPublicUrl(bgPath);

  console.log(`[Carousel ${carouselIndex + 1}] ✅ Stored in Supabase:`, bgPath);

  // 4. Generate slides
  console.log(`[Carousel ${carouselIndex + 1}] Step 4/4: Generating ${num_slides_per_carousel} slides...`);
  
  const slides = [];
  const slideTexts = text_option === 'excel' && excel_data
    ? excel_data
    : await generateTextsWithAlfie(num_slides_per_carousel, theme, supabaseAuth);

  console.log(`[Carousel ${carouselIndex + 1}] Slide texts generated:`, slideTexts.length);

  for (let s = 0; s < num_slides_per_carousel; s++) {
    const slideText = slideTexts[s];
    
    console.log(`[Carousel ${carouselIndex + 1}] Rendering slide ${s + 1}/${num_slides_per_carousel}...`);
    
    // Build Cloudinary URL with text overlays
    const timestamp = Date.now() + s;
    const slideUrl = buildCloudinaryTextOverlayUrl(bgPublicId, {
      title: slideText.title,
      subtitle: slideText.subtitle,
      titleColor: brandData.titleColor,
      subtitleColor: brandData.subtitleColor,
      titleSize: 64,
      subtitleSize: 28,
      titleFont: brandData.titleFont,
      subtitleFont: brandData.subtitleFont,
      titleWeight: 'bold',
      subtitleWeight: 'normal'
    });

    // Add version parameter to avoid cache
    const slideUrlWithVersion = slideUrl.replace(`/${bgPublicId}.png`, `/v${timestamp}/${bgPublicId}.png`);

    // Download rendered slide
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between slides
    const slideBlob = await fetch(slideUrlWithVersion).then(r => r.blob());

    // Store in Supabase storage
    const slidePath = `clients/${user_id}/${campaign_name}/carousel_${String(carouselIndex + 1).padStart(2, '0')}/slides/slide_${String(s + 1).padStart(2, '0')}.png`;
    
    await supabaseAdmin.storage
      .from('media-generations')
      .upload(slidePath, slideBlob, { contentType: 'image/png', upsert: true });

    const { data: { publicUrl: slideStorageUrl } } = supabaseAdmin.storage
      .from('media-generations')
      .getPublicUrl(slidePath);

    slides.push({
      index: s + 1,
      title: slideText.title,
      subtitle: slideText.subtitle,
      storage_url: slideStorageUrl,
      cloudinary_url: slideUrlWithVersion
    });

    console.log(`[Carousel ${carouselIndex + 1}] ✅ Slide ${s + 1}/${num_slides_per_carousel} completed`);
  }

  console.log(`[Carousel ${carouselIndex + 1}] All ${num_slides_per_carousel} slides rendered successfully`);

  // 5. Create metadata and store in database
  console.log(`[Carousel ${carouselIndex + 1}] Storing metadata in database...`);
  
  const carouselMetadata = {
    carousel_index: carouselIndex + 1,
    theme,
    background_url: bgStorageUrl,
    cloudinary_public_id: bgPublicId,
    slides,
    created_at: new Date().toISOString()
  };

  // Store metadata in database
  const { error: insertError } = await supabaseAdmin
    .from('media_generations')
    .insert({
      user_id,
      brand_id,
      type: 'carousel',
      modality: 'bulk_carousel',
      provider_id: 'cloudinary_text_overlay',
      prompt: `${theme} - Carousel ${carouselIndex + 1}`,
      output_url: bgStorageUrl,
      status: 'completed',
      cost_woofs: num_slides_per_carousel,
      params_json: carouselMetadata
    });

  if (insertError) {
    console.error(`[Carousel ${carouselIndex + 1}] Database insert error:`, insertError);
  }

  console.log(`[Carousel ${carouselIndex + 1}] 🎉 Complete!`);

  return carouselMetadata;
}

async function generateTextsWithAlfie(numSlides: number, theme: string, supabaseAuth: any): Promise<SlideText[]> {
  const { data } = await supabaseAuth.functions.invoke('alfie-chat', {
    body: {
      message: `Generate ${numSlides} carousel slide texts for theme: "${theme}". Return JSON array with format: [{"title": "...", "subtitle": "..."}]. Keep titles under 50 chars, subtitles under 80 chars.`,
      conversationId: null
    }
  });

  try {
    const response = data?.response || data?.message || '';
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse Alfie response, using fallback');
  }

  // Fallback
  return Array.from({ length: numSlides }, (_, i) => ({
    title: `${theme} - Slide ${i + 1}`,
    subtitle: `Key point ${i + 1} for your brand`
  }));
}
