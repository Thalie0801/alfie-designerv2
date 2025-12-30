// supabase/functions/video-batch-create/index.ts
// POST /video-batches - Creates a batch of videos with configurable clips (1-10)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

interface BatchSettings {
  videos_count: number;
  clips_per_video?: number; // NEW - default 3, max 10
  ratio: string;
  language: string;
  sfx_transition: string;
  style_lock?: string;
}

interface VideoTextItem {
  title: string;
  caption?: string;
  cta?: string;
  clips?: Array<{ title?: string; subtitle?: string }>; // Dynamic clips text
  // Legacy 3-clip format support
  clip1_title?: string;
  clip1_subtitle?: string;
  clip2_title?: string;
  clip2_subtitle?: string;
  clip3_title?: string;
  clip3_subtitle?: string;
}

interface CreateBatchRequest {
  prompt: string;
  brandId?: string;
  settings: BatchSettings;
  videoTexts?: VideoTextItem[];
}

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

// Base prompts for anti-storyboard generation
const BASE_VEO_PROMPT = `Single full-screen shot. No split-screen, no panels, no storyboard, no clip labels.
Animate the provided reference image with high fidelity. Keep character identity, proportions, outfit, colors, and background consistent.
Motion: subtle blink, tiny head tilt, gentle movement, soft floating particles, slow camera push-in 3%.
No on-screen text, no subtitles, no typography, no logos.`;

// Get clip role based on index and total clips
function getClipRole(clipIndex: number, totalClips: number): string {
  if (clipIndex === 1) return "hook";
  if (clipIndex === totalClips) return "cta";
  return `content_${clipIndex - 1}`;
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

    const body: CreateBatchRequest = await req.json();
    const { prompt, brandId, settings, videoTexts } = body;

    if (!prompt || !settings?.videos_count) {
      return err("Missing prompt or videos_count", 400);
    }

    const videosCount = Math.min(Math.max(1, settings.videos_count), 10); // Limit 1-10 videos
    const clipsPerVideo = Math.min(Math.max(1, settings.clips_per_video || 3), 10); // Limit 1-10 clips, default 3

    console.log(`[video-batch-create] Creating batch for user ${user.id} with ${videosCount} videos × ${clipsPerVideo} clips`);

    // 1. Create the batch
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("video_batches")
      .insert({
        user_id: user.id,
        brand_id: brandId || null,
        input_prompt: prompt,
        settings: {
          videos_count: videosCount,
          clips_per_video: clipsPerVideo,
          ratio: settings.ratio || "9:16",
          language: settings.language || "fr",
          sfx_transition: settings.sfx_transition || "whoosh",
          style_lock: settings.style_lock || null,
        },
        status: "queued",
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      console.error("[video-batch-create] Batch creation error:", batchError);
      return err("Failed to create batch", 500);
    }

    const batchId = batch.id;
    console.log(`[video-batch-create] Created batch ${batchId}`);

    // 2. Create N videos with M clips each
    const videoIds: string[] = [];
    
    for (let videoIndex = 1; videoIndex <= videosCount; videoIndex++) {
      // Create video
      const { data: video, error: videoError } = await supabaseAdmin
        .from("batch_videos")
        .insert({
          batch_id: batchId,
          video_index: videoIndex,
          title: videoTexts?.[videoIndex - 1]?.title || `Vidéo ${videoIndex}`,
          status: "queued",
        })
        .select("id")
        .single();

      if (videoError || !video) {
        console.error(`[video-batch-create] Video ${videoIndex} creation error:`, videoError);
        continue;
      }

      videoIds.push(video.id);
      console.log(`[video-batch-create] Created video ${video.id} (index ${videoIndex})`);

      // Create M clips for this video
      const clips = [];
      for (let clipIndex = 1; clipIndex <= clipsPerVideo; clipIndex++) {
        const clipRole = getClipRole(clipIndex, clipsPerVideo);
        
        clips.push({
          video_id: video.id,
          clip_index: clipIndex,
          anchor_prompt: `${prompt} - ${clipRole} scene ${clipIndex}/${clipsPerVideo}. ${settings.style_lock || "Professional, modern style."}`,
          veo_prompt: `${BASE_VEO_PROMPT} Scene: ${clipRole}. ${prompt}`,
          status: "queued",
          duration_seconds: 8,
        });
      }

      const { error: clipsError } = await supabaseAdmin
        .from("batch_clips")
        .insert(clips);

      if (clipsError) {
        console.error(`[video-batch-create] Clips creation error for video ${video.id}:`, clipsError);
      }

      // Create video texts if provided (support both new and legacy format)
      const textData = videoTexts?.[videoIndex - 1];
      if (textData) {
        // Build dynamic clip texts
        const clipTexts: Record<string, string> = {};
        
        for (let i = 1; i <= clipsPerVideo; i++) {
          // Check new format first (clips array)
          const newFormatClip = textData.clips?.[i - 1];
          // Fallback to legacy format (clip1_title, clip2_title, etc.)
          const textDataAny = textData as unknown as Record<string, string | undefined>;
          const legacyTitle = textDataAny[`clip${i}_title`];
          const legacySubtitle = textDataAny[`clip${i}_subtitle`];
          
          clipTexts[`clip${i}_title`] = newFormatClip?.title || legacyTitle || "";
          clipTexts[`clip${i}_subtitle`] = newFormatClip?.subtitle || legacySubtitle || "";
        }

        const { error: textsError } = await supabaseAdmin
          .from("batch_video_texts")
          .insert({
            video_id: video.id,
            ...clipTexts,
            caption: textData.caption || "",
            cta: textData.cta || "",
          });

        if (textsError) {
          console.error(`[video-batch-create] Texts creation error for video ${video.id}:`, textsError);
        }
      }
    }

    // 3. Enqueue jobs in job_queue for sequential processing
    // We enqueue one job per clip, type = "video_batch_clip"
    const { data: allClips } = await supabaseAdmin
      .from("batch_clips")
      .select("id, video_id, clip_index")
      .in("video_id", videoIds)
      .order("clip_index", { ascending: true });

    if (allClips) {
      // Get video indices for ordering
      const { data: videos } = await supabaseAdmin
        .from("batch_videos")
        .select("id, video_index")
        .in("id", videoIds);

      const videoIndexMap = new Map(videos?.map(v => [v.id, v.video_index]) || []);

      // Sort clips: video 1 clips 1-N, then video 2 clips 1-N, etc.
      const sortedClips = allClips.sort((a, b) => {
        const aVideoIndex = videoIndexMap.get(a.video_id) || 0;
        const bVideoIndex = videoIndexMap.get(b.video_id) || 0;
        if (aVideoIndex !== bVideoIndex) return aVideoIndex - bVideoIndex;
        return a.clip_index - b.clip_index;
      });

      for (const clip of sortedClips) {
        await supabaseAdmin
          .from("job_queue")
          .insert({
            user_id: user.id,
            type: "video_batch_clip",
            status: "queued",
            payload: {
              batchId,
              videoId: clip.video_id,
              clipId: clip.id,
              clipIndex: clip.clip_index,
              brandId: brandId || null,
              settings: { ...settings, clips_per_video: clipsPerVideo },
            },
          });
      }

      console.log(`[video-batch-create] Enqueued ${sortedClips.length} clip jobs`);
    }

    const totalClips = videosCount * clipsPerVideo;
    const woofsCost = totalClips * 25;

    return ok({
      batchId,
      videoIds,
      videosCount,
      clipsPerVideo,
      totalClips,
      woofsCost,
      status: "queued",
      message: `Batch créé avec ${videosCount} vidéos × ${clipsPerVideo} clips (${totalClips} clips total, ${woofsCost} Woofs). Génération séquentielle en cours...`,
    });

  } catch (error) {
    console.error("[video-batch-create] Error:", error);
    return err(error instanceof Error ? error.message : "Internal error", 500);
  }
});
