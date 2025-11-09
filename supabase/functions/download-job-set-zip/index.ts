import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { encodeOverlayText as encodeCloudinaryText } from "../_shared/cloudinaryText.ts";
import { stripControlChars } from "../../../../src/lib/regex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== CLOUDINARY OVERLAY HELPERS ==========

function extractCloudName(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/https?:\/\/res\.cloudinary\.com\/([^/]+)\//i);
  return match?.[1];
}

/**
 * Dérive le public_id depuis une URL Cloudinary complète
 * Exemple: https://res.cloudinary.com/dcuvvilto/image/upload/v1762505257/alfie/abc123.png
 * → public_id = alfie/abc123
 */
function derivePublicIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  
  // Pattern: /upload/[v1234567890/]path/to/file.ext
  const match = url.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.\w+)?$/i);
  if (!match) return undefined;
  
  let derivedId = match[1];
  
  // Enlever l'extension si présente
  derivedId = derivedId.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
  
  console.log(`[derivePublicId] Derived '${derivedId}' from URL: ${url.substring(0, 100)}...`);
  return derivedId;
}

const EXTRA_INVISIBLE_RE = new RegExp('[\\x7F\\u00A0\\uFEFF]', 'g');

function normalizeSpaces(text: string): string {
  return stripControlChars(text).replace(EXTRA_INVISIBLE_RE, '').replace(/\s+/g, ' ').trim();
}

function cleanText(text: string, maxLen = 220): string {
  let cleaned = normalizeSpaces(text);
  // Remove emojis
  try {
    cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  }
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned.trim();
}

function buildOverlayUrl(slide: any): string | null {
  const cloudName = extractCloudName(slide.cloudinary_url);
  const publicId = slide.cloudinary_public_id || derivePublicIdFromUrl(slide.cloudinary_url);

  console.log(
    `[buildOverlayUrl] slide=${slide.id} cloudName=${cloudName} publicId=${publicId} has_text=${!!slide.text_json}`
  );

  if (!cloudName) {
    console.warn(`[buildOverlayUrl] ❌ Missing cloudName for slide ${slide.id}`);
    return null;
  }

  if (!publicId) {
    console.warn(`[buildOverlayUrl] ❌ Missing publicId for slide ${slide.id}`);
    return null;
  }

  if (!slide.text_json) {
    console.warn(`[buildOverlayUrl] ❌ Missing text_json for slide ${slide.id}`);
    return null;
  }

  const { title, subtitle, bullets = [] } = slide.text_json;
  const cleanTitle = cleanText(title || '', 120);
  const cleanSubtitle = cleanText(subtitle || '', 220);
  const cleanBullets = (bullets || []).map((b: string) => cleanText(b, 80)).slice(0, 6);

  if (!cleanTitle || cleanTitle.trim() === '') {
    console.warn(`[buildOverlayUrl] ❌ Empty title after cleaning for slide ${slide.id}`);
    return null;
  }

  console.log(
    `[buildOverlayUrl] ✅ Building overlay for slide ${slide.id}, title="${cleanTitle.substring(0, 30)}..."`
  );
  
  const format = slide.format || '4:5';
  
  // Dimensions selon format
  const dims = 
    format === '9:16' ? { w: 1080, h: 1920 } :
    format === '16:9' ? { w: 1920, h: 1080 } :
    format === '1:1' ? { w: 1080, h: 1080 } :
    { w: 1080, h: 1350 }; // 4:5
  
  const baseTransform = `w_${dims.w},h_${dims.h},c_fill,f_png`;
  
  const overlays: string[] = [];
  
  // Titre centré en haut (même logique que slideUrl)
  const titleSize = format === '9:16' ? 80 : format === '16:9' ? 64 : 72;
  const titleY = Math.round(dims.h * 0.1);
  overlays.push(
    `l_text:Arial_${titleSize}_bold:${encodeCloudinaryText(cleanTitle)},co_rgb:FFFFFF,g_north,y_${titleY},w_${Math.round(dims.w * 0.9)},c_fit`
  );
  
  // Sous-titre centré bas
  if (cleanSubtitle && cleanSubtitle.trim() !== '') {
    const subSize = format === '9:16' ? 52 : format === '16:9' ? 38 : 42;
    const subY = format === '9:16' ? 220 : 140;
    overlays.push(
      `l_text:Arial_${subSize}:${encodeCloudinaryText(cleanSubtitle)},co_rgb:E5E7EB,g_south,y_${subY},w_${Math.round(dims.w * 0.84)},c_fit`
    );
  }
  
  // Bullets centrés
  if (cleanBullets.length > 0) {
    const bulletSize = format === '16:9' ? 32 : 36;
    const startY = Math.round(dims.h * 0.45);
    const step = 56;
    cleanBullets.forEach((b: string, i: number) => {
      if (b.trim() !== '') {
        overlays.push(
          `l_text:Arial_${bulletSize}:${encodeCloudinaryText('• ' + b)},co_rgb:FFFFFF,g_center,y_${startY + i * step},w_${Math.round(dims.w * 0.8)},c_fit`
        );
      }
    });
  }

  const overlayTransforms = overlays.length > 0 ? '/' + overlays.join('/') : '';
  const finalUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${baseTransform}${overlayTransforms}/${publicId}`;
  
  console.log(`[buildOverlay] ✅ Built overlay URL for slide ${slide.id} (${format})`);
  return finalUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const requestUrl = new URL(req.url);
    const queryCarouselId = requestUrl.searchParams.get('carousel_id') || requestUrl.searchParams.get('carouselId');
    const queryOrderId = requestUrl.searchParams.get('order_id') || requestUrl.searchParams.get('orderId');

    let bodyCarouselId: string | null = null;
    let bodyOrderId: string | null = null;

    if (req.method !== 'GET') {
      try {
        const parsed = await req.json();
        bodyCarouselId = parsed?.carouselId ?? null;
        bodyOrderId = parsed?.orderId ?? null;
      } catch {
        // ignore empty body
      }
    }

    const carouselId = bodyCarouselId || queryCarouselId;
    const orderId = bodyOrderId || queryOrderId;

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
      .select('id, slide_index, cloudinary_url, cloudinary_public_id, text_json, format, metadata, carousel_id, order_id')
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
      const meta = (slide.metadata as any) || {};
      
      // ✅ NOUVEAU : Tenter d'abord l'URL overlay
      let imageUrl = buildOverlayUrl(slide);
      
      // Fallback vers images de base si pas d'overlay possible
      if (!imageUrl) {
        imageUrl = slide.cloudinary_url;
        console.log(`[download-zip] No overlay for slide ${slide.id}, using base image`);
      }
      
      if (!imageUrl && meta.cloudinary_base_url) {
        imageUrl = meta.cloudinary_base_url;
      }

      if (!imageUrl) {
        console.warn(`[download-zip] ⚠️ No URL found for slide ${slide.id}`);
        failureCount++;
        continue;
      }

      try {
        const overlayIndicator = imageUrl.includes('l_text:') ? '🎨 WITH OVERLAY' : '📦 base';
        console.log(
          `[download-zip] Downloading slide ${slide.slide_index} ${overlayIndicator}: ${imageUrl.substring(
            0,
            120
          )}...`
        );

        const response = await fetch(imageUrl);
        
        if (!response.ok) {
          console.warn(`[download-zip] ⚠️ Overlay failed (${response.status}), trying base...`);
          
          // Fallback vers image de base si overlay échoue
          if (slide.cloudinary_url) {
            const fallbackResp = await fetch(slide.cloudinary_url);
            if (fallbackResp.ok) {
              const blob = await fallbackResp.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const slideNum = (slide.slide_index ?? 0) + 1;
              const filename = `slide-${slideNum.toString().padStart(2, '0')}.png`;
              zip.file(filename, new Uint8Array(arrayBuffer));
              console.log(`[download-zip] ✅ Added ${filename} via base fallback`);
              successCount++;
              continue;
            }
          }
          
          failureCount++;
          continue;
        }

        // Success - ajouter au ZIP
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const slideNum = (slide.slide_index ?? 0) + 1;
        const filename = `slide-${slideNum.toString().padStart(2, '0')}.png`;
        zip.file(filename, new Uint8Array(arrayBuffer));
        console.log(`[download-zip] ✅ Added ${filename} (${arrayBuffer.byteLength} bytes) ${imageUrl.includes('l_text:') ? '🎨 WITH OVERLAY' : '📦 base'}`);
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

    // URL signée (1h)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('media-generations')
      .createSignedUrl(zipFileName, 60 * 60);

    if (signedErr || !signedData?.signedUrl) {
      console.error('[download-zip] Signed URL error:', signedErr);
      throw signedErr ?? new Error('Failed to create signed URL');
    }

    const zipUrl = signedData.signedUrl;
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
