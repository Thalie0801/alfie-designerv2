// supabase/functions/video-batch-status/index.ts
// GET /video-batches/:id - Returns full batch status with videos, clips, texts

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const supabaseAdmin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return err("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return err("Invalid token", 401);
    }

    // Get batchId from URL or body
    const url = new URL(req.url);
    let batchId = url.searchParams.get("batchId");
    
    if (!batchId && req.method === "POST") {
      const body = await req.json();
      batchId = body.batchId;
    }

    if (!batchId) {
      return err("Missing batchId", 400);
    }

    console.log(`[video-batch-status] Fetching batch ${batchId} for user ${user.id}`);

    // 1. Get batch (with user ownership check)
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("video_batches")
      .select("*")
      .eq("id", batchId)
      .eq("user_id", user.id)
      .single();

    if (batchError || !batch) {
      return err("Batch not found", 404);
    }

    // 2. Get all videos for this batch
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("batch_videos")
      .select("*")
      .eq("batch_id", batchId)
      .order("video_index", { ascending: true });

    if (videosError) {
      console.error("[video-batch-status] Videos fetch error:", videosError);
      return err("Failed to fetch videos", 500);
    }

    const videoIds = videos?.map(v => v.id) || [];

    // 3. Get all clips for these videos
    const { data: clips, error: clipsError } = await supabaseAdmin
      .from("batch_clips")
      .select("*")
      .in("video_id", videoIds.length ? videoIds : ["00000000-0000-0000-0000-000000000000"])
      .order("clip_index", { ascending: true });

    if (clipsError) {
      console.error("[video-batch-status] Clips fetch error:", clipsError);
    }

    // 4. Get all texts for these videos
    const { data: texts, error: textsError } = await supabaseAdmin
      .from("batch_video_texts")
      .select("*")
      .in("video_id", videoIds.length ? videoIds : ["00000000-0000-0000-0000-000000000000"]);

    if (textsError) {
      console.error("[video-batch-status] Texts fetch error:", textsError);
    }

    // 5. Assemble response with nested structure
    const videosWithClips = videos?.map(video => {
      const videoClips = clips?.filter(c => c.video_id === video.id) || [];
      const videoTexts = texts?.find(t => t.video_id === video.id) || null;

      // Calculate video progress
      const completedClips = videoClips.filter(c => c.status === "done").length;
      const totalClips = videoClips.length;
      const progress = totalClips > 0 ? Math.round((completedClips / totalClips) * 100) : 0;

      return {
        ...video,
        clips: videoClips.map(c => ({
          id: c.id,
          clipIndex: c.clip_index,
          status: c.status,
          error: c.error,
          anchorUrl: c.anchor_url,
          clipUrl: c.clip_url,
          durationSeconds: c.duration_seconds,
        })),
        texts: videoTexts ? {
          clip1Title: videoTexts.clip1_title,
          clip1Subtitle: videoTexts.clip1_subtitle,
          clip2Title: videoTexts.clip2_title,
          clip2Subtitle: videoTexts.clip2_subtitle,
          clip3Title: videoTexts.clip3_title,
          clip3Subtitle: videoTexts.clip3_subtitle,
          caption: videoTexts.caption,
          cta: videoTexts.cta,
        } : null,
        progress,
        completedClips,
        totalClips,
      };
    }) || [];

    // 6. Calculate overall batch progress
    const allClipsStatuses = clips?.map(c => c.status) || [];
    const completedClipsTotal = allClipsStatuses.filter(s => s === "done").length;
    const errorClipsTotal = allClipsStatuses.filter(s => s === "error").length;
    const totalClipsCount = allClipsStatuses.length;
    const overallProgress = totalClipsCount > 0 
      ? Math.round((completedClipsTotal / totalClipsCount) * 100) 
      : 0;

    // Determine overall status
    let computedStatus = batch.status;
    if (completedClipsTotal === totalClipsCount && totalClipsCount > 0) {
      computedStatus = "done";
    } else if (errorClipsTotal === totalClipsCount && totalClipsCount > 0) {
      computedStatus = "error";
    } else if (allClipsStatuses.some(s => s === "processing")) {
      computedStatus = "processing";
    }

    return ok({
      batch: {
        id: batch.id,
        inputPrompt: batch.input_prompt,
        settings: batch.settings,
        status: computedStatus,
        error: batch.error,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
      },
      videos: videosWithClips,
      progress: overallProgress,
      completedClips: completedClipsTotal,
      errorClips: errorClipsTotal,
      totalClips: totalClipsCount,
    });

  } catch (error) {
    console.error("[video-batch-status] Error:", error);
    return err(error instanceof Error ? error.message : "Internal error", 500);
  }
});
