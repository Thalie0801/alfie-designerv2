import { v2 as cloudinary } from 'npm:cloudinary@2.8.0';
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

/**
 * RGPD-compliant cleanup function
 * - Deletes assets older than 30 days from Cloudinary AND database
 * - Handles both library_assets and media_generations tables
 * - Works in batches to avoid timeouts
 * - Logs deletions for RGPD audit (without personal data)
 */

cloudinary.config({
  cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME'),
  api_key: Deno.env.get('CLOUDINARY_API_KEY'),
  api_secret: Deno.env.get('CLOUDINARY_API_SECRET'),
});

// Helper to extract public_id from Cloudinary URL
function extractPublicId(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  try {
    // URL format: https://res.cloudinary.com/{cloud}/[image|video]/upload/[version/]{public_id}.{format}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (match) {
      return match[1];
    }
    // Also try format without extension
    const match2 = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    return match2 ? match2[1] : null;
  } catch {
    return null;
  }
}

async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'video'): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error(`[CLEANUP-30D] Cloudinary delete error for ${publicId}:`, error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const stats = {
    libraryAssetsDeleted: 0,
    libraryAssetsCloudinaryDeleted: 0,
    mediaGenerationsDeleted: 0,
    mediaGenerationsCloudinaryDeleted: 0,
    errors: [] as string[],
  };

  try {
    console.log("[CLEANUP-30D] Starting RGPD 30-day cleanup...");
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ============================================
    // Step 1: Cleanup library_assets
    // ============================================
    console.log("[CLEANUP-30D] Step 1: Processing library_assets...");
    
    let batchCount = 0;
    while (true) {
      const { data: oldAssets, error: fetchError } = await supabase
        .from("library_assets")
        .select("id, cloudinary_public_id, cloudinary_url, type")
        .lt("created_at", thirtyDaysAgo)
        .limit(50);

      if (fetchError) {
        console.error("[CLEANUP-30D] Error fetching library_assets:", fetchError);
        stats.errors.push(`library_assets fetch: ${fetchError.message}`);
        break;
      }

      if (!oldAssets || oldAssets.length === 0) {
        console.log(`[CLEANUP-30D] library_assets: No more records (${batchCount} batches processed)`);
        break;
      }

      batchCount++;
      console.log(`[CLEANUP-30D] library_assets batch ${batchCount}: Processing ${oldAssets.length} records...`);

      // Delete from Cloudinary first
      for (const asset of oldAssets) {
        const publicId = asset.cloudinary_public_id || extractPublicId(asset.cloudinary_url);
        if (publicId) {
          const resourceType = asset.type === 'video' ? 'video' : 'image';
          const deleted = await deleteFromCloudinary(publicId, resourceType);
          if (deleted) {
            stats.libraryAssetsCloudinaryDeleted++;
          }
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from("library_assets")
        .delete()
        .in("id", oldAssets.map(a => a.id));

      if (deleteError) {
        console.error("[CLEANUP-30D] Error deleting library_assets:", deleteError);
        stats.errors.push(`library_assets delete: ${deleteError.message}`);
      } else {
        stats.libraryAssetsDeleted += oldAssets.length;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ============================================
    // Step 2: Cleanup media_generations
    // ============================================
    console.log("[CLEANUP-30D] Step 2: Processing media_generations...");
    
    batchCount = 0;
    while (true) {
      const { data: oldMedia, error: fetchError } = await supabase
        .from("media_generations")
        .select("id, output_url, thumbnail_url, type, metadata")
        .lt("created_at", thirtyDaysAgo)
        .limit(50);

      if (fetchError) {
        console.error("[CLEANUP-30D] Error fetching media_generations:", fetchError);
        stats.errors.push(`media_generations fetch: ${fetchError.message}`);
        break;
      }

      if (!oldMedia || oldMedia.length === 0) {
        console.log(`[CLEANUP-30D] media_generations: No more records (${batchCount} batches processed)`);
        break;
      }

      batchCount++;
      console.log(`[CLEANUP-30D] media_generations batch ${batchCount}: Processing ${oldMedia.length} records...`);

      // Delete from Cloudinary
      for (const media of oldMedia) {
        // Try output_url
        const outputPublicId = extractPublicId(media.output_url);
        if (outputPublicId) {
          const resourceType = media.type === 'video' ? 'video' : 'image';
          const deleted = await deleteFromCloudinary(outputPublicId, resourceType);
          if (deleted) {
            stats.mediaGenerationsCloudinaryDeleted++;
          }
        }

        // Try thumbnail_url (for videos)
        if (media.thumbnail_url) {
          const thumbPublicId = extractPublicId(media.thumbnail_url);
          if (thumbPublicId) {
            await deleteFromCloudinary(thumbPublicId, 'image');
          }
        }

        // Check metadata for additional Cloudinary public_ids
        if (media.metadata && typeof media.metadata === 'object') {
          const meta = media.metadata as Record<string, unknown>;
          if (meta.cloudinary_public_id) {
            await deleteFromCloudinary(meta.cloudinary_public_id as string, media.type === 'video' ? 'video' : 'image');
          }
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from("media_generations")
        .delete()
        .in("id", oldMedia.map(m => m.id));

      if (deleteError) {
        console.error("[CLEANUP-30D] Error deleting media_generations:", deleteError);
        stats.errors.push(`media_generations delete: ${deleteError.message}`);
      } else {
        stats.mediaGenerationsDeleted += oldMedia.length;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ============================================
    // Step 3: RGPD Audit Log (no personal data)
    // ============================================
    console.log("[CLEANUP-30D] RGPD Audit Summary:", {
      date: new Date().toISOString(),
      library_assets_deleted: stats.libraryAssetsDeleted,
      library_assets_cloudinary_deleted: stats.libraryAssetsCloudinaryDeleted,
      media_generations_deleted: stats.mediaGenerationsDeleted,
      media_generations_cloudinary_deleted: stats.mediaGenerationsCloudinaryDeleted,
      retention_policy: "30 days",
      errors_count: stats.errors.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "RGPD 30-day cleanup completed",
        stats: {
          library_assets: {
            db_deleted: stats.libraryAssetsDeleted,
            cloudinary_deleted: stats.libraryAssetsCloudinaryDeleted,
          },
          media_generations: {
            db_deleted: stats.mediaGenerationsDeleted,
            cloudinary_deleted: stats.mediaGenerationsCloudinaryDeleted,
          },
          total_db_deleted: stats.libraryAssetsDeleted + stats.mediaGenerationsDeleted,
          total_cloudinary_deleted: stats.libraryAssetsCloudinaryDeleted + stats.mediaGenerationsCloudinaryDeleted,
          errors: stats.errors,
        },
        retention_policy: "30 days",
        rgpd_compliant: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[CLEANUP-30D] Fatal error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, stats }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
