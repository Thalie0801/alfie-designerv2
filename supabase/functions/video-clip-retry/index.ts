// supabase/functions/video-clip-retry/index.ts
// POST /clips/:id/retry - Retry a failed clip

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

    const body = await req.json();
    const { clipId } = body;

    if (!clipId) {
      return err("Missing clipId", 400);
    }

    console.log(`[video-clip-retry] Retrying clip ${clipId} for user ${user.id}`);

    // Get clip with ownership check via video -> batch -> user
    const { data: clip, error: clipError } = await supabaseAdmin
      .from("batch_clips")
      .select(`
        id,
        video_id,
        clip_index,
        status,
        anchor_prompt,
        veo_prompt
      `)
      .eq("id", clipId)
      .single();

    if (clipError || !clip) {
      return err("Clip not found", 404);
    }

    // Verify ownership through video -> batch chain
    const { data: video } = await supabaseAdmin
      .from("batch_videos")
      .select("id, batch_id")
      .eq("id", clip.video_id)
      .single();

    if (!video) {
      return err("Video not found", 404);
    }

    const { data: batch } = await supabaseAdmin
      .from("video_batches")
      .select("id, user_id, brand_id, settings")
      .eq("id", video.batch_id)
      .single();

    if (!batch || batch.user_id !== user.id) {
      return err("Unauthorized", 403);
    }

    // Reset clip status
    const { error: updateError } = await supabaseAdmin
      .from("batch_clips")
      .update({
        status: "queued",
        error: null,
        anchor_url: null,
        anchor_public_id: null,
        clip_url: null,
        clip_public_id: null,
      })
      .eq("id", clipId);

    if (updateError) {
      console.error("[video-clip-retry] Update error:", updateError);
      return err("Failed to reset clip", 500);
    }

    // Re-enqueue the job
    const { error: jobError } = await supabaseAdmin
      .from("job_queue")
      .insert({
        user_id: user.id,
        type: "video_batch_clip",
        status: "queued",
        payload: {
          batchId: batch.id,
          videoId: clip.video_id,
          clipId: clip.id,
          clipIndex: clip.clip_index,
          brandId: batch.brand_id,
          settings: batch.settings,
          isRetry: true,
        },
      });

    if (jobError) {
      console.error("[video-clip-retry] Job enqueue error:", jobError);
      return err("Failed to enqueue retry job", 500);
    }

    console.log(`[video-clip-retry] Clip ${clipId} queued for retry`);

    return ok({
      clipId,
      status: "queued",
      message: "Clip remis en file d'attente pour re-génération",
    });

  } catch (error) {
    console.error("[video-clip-retry] Error:", error);
    return err(error instanceof Error ? error.message : "Internal error", 500);
  }
});
