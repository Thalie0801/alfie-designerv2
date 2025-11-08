import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Phase 7: Backfill legacy carousel slides with proper public_id structure
 * 
 * This function updates existing carousel slides to use the new naming convention:
 * alfie/{brandId}/{campaignId}/slides/slide_XX
 * 
 * It extracts the base public_id from existing URLs and updates the database.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { limit = 100, dryRun = true } = await req.json().catch(() => ({}));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[backfill] Starting backfill process...', { limit, dryRun });

    // Get carousel slides that need backfilling
    const { data: slides, error: fetchError } = await supabaseAdmin
      .from('library_assets')
      .select('id, cloudinary_url, cloudinary_public_id, brand_id, carousel_id, slide_index, metadata')
      .eq('type', 'carousel_slide')
      .or('cloudinary_public_id.is.null,cloudinary_public_id.like.%l_text:%')
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch slides: ${fetchError.message}`);
    }

    if (!slides || slides.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No slides need backfilling',
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill] Found ${slides.length} slides to process`);

    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[],
      skipped: [] as { id: string; reason: string }[],
    };

    for (const slide of slides) {
      try {
        if (!slide.brand_id || !slide.carousel_id || slide.slide_index === null) {
          results.skipped.push({
            id: slide.id,
            reason: 'Missing brand_id, carousel_id, or slide_index'
          });
          continue;
        }

        // Extract base public_id from existing URL or metadata
        let basePublicId = slide.cloudinary_public_id;

        // If public_id contains transformations, try to extract from metadata
        if (!basePublicId || basePublicId.includes('l_text:')) {
          const cloudinaryBaseUrl = slide.metadata?.cloudinary_base_url;
          if (cloudinaryBaseUrl) {
            basePublicId = extractPublicIdFromUrl(cloudinaryBaseUrl);
          }
        }

        if (!basePublicId) {
          results.failed.push({
            id: slide.id,
            reason: 'Could not extract base public_id'
          });
          continue;
        }

        // Generate new public_id with proper structure
        const newPublicId = `alfie/${slide.brand_id}/${slide.carousel_id}/slides/slide_${String(slide.slide_index + 1).padStart(2, '0')}`;

        console.log(`[backfill] Processing slide ${slide.id}:`, {
          old: basePublicId,
          new: newPublicId
        });

        if (!dryRun) {
          // Copy asset on Cloudinary with new public_id
          const { data: copyData, error: copyError } = await supabaseAdmin.functions.invoke('cloudinary', {
            body: {
              action: 'upload',
              params: {
                file: slide.cloudinary_url,
                folder: `alfie/${slide.brand_id}/${slide.carousel_id}/slides`,
                public_id: `slide_${String(slide.slide_index + 1).padStart(2, '0')}`,
                resource_type: 'image',
                tags: [slide.brand_id, slide.carousel_id, 'carousel_slide', 'backfilled'],
              }
            }
          });

          if (copyError) {
            results.failed.push({
              id: slide.id,
              reason: `Cloudinary copy failed: ${copyError.message}`
            });
            continue;
          }

          // Update database with new public_id
          const { error: updateError } = await supabaseAdmin
            .from('library_assets')
            .update({
              cloudinary_public_id: copyData.public_id,
              metadata: {
                ...slide.metadata,
                original_public_id: copyData.public_id,
                backfilled_at: new Date().toISOString(),
                old_public_id: basePublicId
              }
            })
            .eq('id', slide.id);

          if (updateError) {
            results.failed.push({
              id: slide.id,
              reason: `Database update failed: ${updateError.message}`
            });
            continue;
          }
        }

        results.success.push(slide.id);
      } catch (error: any) {
        results.failed.push({
          id: slide.id,
          reason: error.message
        });
      }
    }

    console.log('[backfill] Process completed:', {
      total: slides.length,
      success: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        total: slides.length,
        processed: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[backfill] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to extract public_id from Cloudinary URL
function extractPublicIdFromUrl(url: string | null | undefined): string | null {
  try {
    if (!url) return null;
    const uploadMarker = '/image/upload/';
    const idx = url.indexOf(uploadMarker);
    if (idx === -1) return null;
    const rest = url.substring(idx + uploadMarker.length);

    // If version segment exists, everything after it is the public_id
    const vMatch = rest.match(/v\d+\/(.+)$/);
    if (vMatch && vMatch[1]) {
      let pid = vMatch[1];
      pid = pid.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
      return pid;
    }

    // Fallback: strip one transform segment
    const firstSlash = rest.indexOf('/');
    if (firstSlash !== -1) {
      let pid = rest.substring(firstSlash + 1);
      pid = pid.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
      if (pid && !pid.includes('l_text:') && !pid.includes(',')) return pid;
    }

    return null;
  } catch (e) {
    console.error('[backfill] extractPublicIdFromUrl error', e);
    return null;
  }
}
