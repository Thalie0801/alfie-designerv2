import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const { carouselId, orderId } = await req.json();
    if (!carouselId && !orderId) throw new Error('Missing carouselId or orderId');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    console.log(`[download-zip] User ${user.id} requesting ZIP for carousel=${carouselId}, order=${orderId}`);

    // Récupérer toutes les slides du carrousel depuis library_assets
    // PRIORITÉ: order_id (plus stable) > carousel_id (change entre régénérations)
    let query = supabase
      .from('library_assets')
      .select('id, slide_index, cloudinary_url, metadata, carousel_id, order_id')
      .eq('type', 'carousel_slide')
      .eq('user_id', user.id)
      .order('slide_index');

    // Utiliser order_id en priorité car il est stable entre régénérations
    if (orderId) {
      query = query.eq('order_id', orderId);
      console.log(`[download-zip] Querying by order_id: ${orderId}`);
    } else if (carouselId) {
      query = query.eq('carousel_id', carouselId);
      console.log(`[download-zip] Querying by carousel_id: ${carouselId}`);
    }

    const { data: slides, error: slidesErr } = await query;

    if (slidesErr) {
      console.error('[download-zip] Query error:', slidesErr);
      throw slidesErr;
    }
    if (!slides || slides.length === 0) {
      console.error('[download-zip] No slides found for carousel/order');
      throw new Error('No slides found for this carousel');
    }

    console.log(`[download-zip] Found ${slides.length} slides for ${orderId ? 'order' : 'carousel'}`);

    // Créer le ZIP
    const zip = new JSZip();
    let successCount = 0;
    let failureCount = 0;

    for (const slide of slides) {
      // Priorité 1: cloudinary_url (avec overlay texte)
      // Priorité 2: metadata.cloudinary_base_url (fallback sans texte)
      const meta = (slide.metadata as any) || {};
      let imageUrl = slide.cloudinary_url;
      
      if (!imageUrl && meta.cloudinary_base_url) {
        imageUrl = meta.cloudinary_base_url;
        console.log(`[download-zip] Using base URL for slide ${slide.id}`);
      }

      if (!imageUrl) {
        console.warn(`[download-zip] ⚠️ No URL found for slide ${slide.id} (index ${slide.slide_index})`);
        failureCount++;
        continue;
      }

      try {
        console.log(`[download-zip] Fetching slide ${slide.slide_index}: ${imageUrl.substring(0, 100)}...`);
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.warn(`[download-zip] ⚠️ Failed to fetch (${response.status}): ${imageUrl.substring(0, 150)}`);
          
          // Try fallback to base_url if main URL failed
          if (meta.cloudinary_base_url && imageUrl !== meta.cloudinary_base_url) {
            console.log(`[download-zip] Trying fallback base_url...`);
            const fallbackResp = await fetch(meta.cloudinary_base_url);
            if (fallbackResp.ok) {
              const blob = await fallbackResp.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const slideNum = (slide.slide_index ?? 0) + 1;
              const filename = `slide-${slideNum.toString().padStart(2, '0')}.png`;
              zip.file(filename, new Uint8Array(arrayBuffer));
              console.log(`[download-zip] ✅ Added ${filename} via fallback (${arrayBuffer.byteLength} bytes)`);
              successCount++;
              continue;
            }
          }
          
          failureCount++;
          continue;
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const slideNum = (slide.slide_index ?? 0) + 1;
        const filename = `slide-${slideNum.toString().padStart(2, '0')}.png`;
        zip.file(filename, new Uint8Array(arrayBuffer));
        console.log(`[download-zip] ✅ Added ${filename} to ZIP (${arrayBuffer.byteLength} bytes)`);
        successCount++;
      } catch (err) {
        console.error(`[download-zip] ❌ Error fetching slide ${slide.id}:`, err);
        failureCount++;
      }
    }

    console.log(`[download-zip] Summary: ${successCount} successful, ${failureCount} failed`);
    
    if (successCount === 0) {
      throw new Error('No slides could be downloaded - all images failed to load');
    }

    // Générer le ZIP en blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const arrayBuffer = await zipBlob.arrayBuffer();

    // Uploader le ZIP dans le storage
    const identifier = carouselId || orderId;
    const zipFileName = `zips/carousel-${identifier}-${Date.now()}.zip`;
    console.log(`[download-zip] Uploading ZIP to storage: ${zipFileName}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-generations')
      .upload(zipFileName, new Uint8Array(arrayBuffer), {
        contentType: 'application/zip',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('[download-zip] Upload failed:', uploadError);
      throw uploadError;
    }

    // Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from('media-generations')
      .getPublicUrl(zipFileName);

    const zipUrl = publicUrlData.publicUrl;
    console.log(`[download-zip] ZIP uploaded successfully: ${zipUrl}`);

    return new Response(JSON.stringify({ 
      url: zipUrl,
      filename: `carousel-${identifier}.zip`,
      size: arrayBuffer.byteLength
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('[download-zip] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
