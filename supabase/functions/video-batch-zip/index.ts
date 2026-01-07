// supabase/functions/video-batch-zip/index.ts
// GET /video-batches/:id/zip - Generate ZIP with CSV, texts, manifest

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

function escapeCSV(str: string): string {
  const cleaned = (str || "").replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${cleaned}"`;
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

    console.log(`[video-batch-zip] Generating ZIP for batch ${batchId}`);

    // Get batch with ownership check
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("video_batches")
      .select("*")
      .eq("id", batchId)
      .eq("user_id", user.id)
      .single();

    if (batchError || !batch) {
      return err("Batch not found", 404);
    }

    // Get videos
    const { data: videos } = await supabaseAdmin
      .from("batch_videos")
      .select("*")
      .eq("batch_id", batchId)
      .order("video_index", { ascending: true });

    const videoIds = videos?.map(v => v.id) || [];

    // Get clips
    const { data: clips } = await supabaseAdmin
      .from("batch_clips")
      .select("*")
      .in("video_id", videoIds.length ? videoIds : ["00000000-0000-0000-0000-000000000000"])
      .order("clip_index", { ascending: true });

    // Get texts
    const { data: texts } = await supabaseAdmin
      .from("batch_video_texts")
      .select("*")
      .in("video_id", videoIds.length ? videoIds : ["00000000-0000-0000-0000-000000000000"]);

    // 1. Generate CSV content
    const csvHeaders = "batch_key,video_index,video_title,clip1_title,clip1_subtitle,clip2_title,clip2_subtitle,clip3_title,clip3_subtitle,cta";
    const csvRows = videos?.map(video => {
      const videoTexts = texts?.find(t => t.video_id === video.id);
      return [
        escapeCSV(batchId!),
        video.video_index,
        escapeCSV(video.title || `Vidéo ${video.video_index}`),
        escapeCSV(videoTexts?.clip1_title || ""),
        escapeCSV(videoTexts?.clip1_subtitle || ""),
        escapeCSV(videoTexts?.clip2_title || ""),
        escapeCSV(videoTexts?.clip2_subtitle || ""),
        escapeCSV(videoTexts?.clip3_title || ""),
        escapeCSV(videoTexts?.clip3_subtitle || ""),
        escapeCSV(videoTexts?.cta || ""),
      ].join(",");
    }) || [];
    const csvContent = `${csvHeaders}\n${csvRows.join("\n")}`;

    // 2. Generate texts.md content
    let textsMarkdown = `# Batch Vidéos - Textes\n\nBatch ID: ${batchId}\nCréé le: ${new Date(batch.created_at).toLocaleDateString('fr-FR')}\n\n---\n\n`;
    
    for (const video of videos || []) {
      const videoTexts = texts?.find(t => t.video_id === video.id);
      const videoClips = clips?.filter(c => c.video_id === video.id) || [];
      
      textsMarkdown += `## 🎬 Vidéo ${video.video_index}: ${video.title || 'Sans titre'}\n\n`;
      
      if (videoTexts?.caption) {
        textsMarkdown += `### Caption\n${videoTexts.caption}\n\n`;
      }
      
      if (videoTexts?.cta) {
        textsMarkdown += `### CTA\n${videoTexts.cta}\n\n`;
      }
      
      textsMarkdown += `### Textes des clips\n`;
      textsMarkdown += `| Clip | Titre | Sous-titre |\n`;
      textsMarkdown += `|------|-------|------------|\n`;
      textsMarkdown += `| 1 | ${videoTexts?.clip1_title || '-'} | ${videoTexts?.clip1_subtitle || '-'} |\n`;
      textsMarkdown += `| 2 | ${videoTexts?.clip2_title || '-'} | ${videoTexts?.clip2_subtitle || '-'} |\n`;
      textsMarkdown += `| 3 | ${videoTexts?.clip3_title || '-'} | ${videoTexts?.clip3_subtitle || '-'} |\n`;
      
      textsMarkdown += `\n### URLs des clips\n`;
      for (const clip of videoClips) {
        textsMarkdown += `- Clip ${clip.clip_index}: ${clip.clip_url || 'En cours...'}\n`;
      }
      
      textsMarkdown += `\n---\n\n`;
    }

    // 3. Generate manifest.json
    const manifest = {
      batch_id: batchId,
      created_at: batch.created_at,
      settings: batch.settings,
      status: batch.status,
      videos: videos?.map(video => {
        const videoTexts = texts?.find(t => t.video_id === video.id);
        const videoClips = clips?.filter(c => c.video_id === video.id) || [];
        
        return {
          id: video.id,
          index: video.video_index,
          title: video.title,
          status: video.status,
          texts: {
            clip1: { title: videoTexts?.clip1_title, subtitle: videoTexts?.clip1_subtitle },
            clip2: { title: videoTexts?.clip2_title, subtitle: videoTexts?.clip2_subtitle },
            clip3: { title: videoTexts?.clip3_title, subtitle: videoTexts?.clip3_subtitle },
            caption: videoTexts?.caption,
            cta: videoTexts?.cta,
          },
          clips: videoClips.map(c => ({
            index: c.clip_index,
            status: c.status,
            anchor_url: c.anchor_url,
            clip_url: c.clip_url,
            duration: c.duration_seconds,
          })),
        };
      }) || [],
    };

    // Return JSON with all file contents (frontend will create ZIP with JSZip)
    return ok({
      batchId,
      filename: `batch-${batchId.slice(0, 8)}.zip`,
      files: {
        "csv/canva_bulk.csv": csvContent,
        "texts/texts.md": textsMarkdown,
        "manifest/manifest.json": JSON.stringify(manifest, null, 2),
      },
      clipUrls: clips?.filter(c => c.clip_url).map(c => ({
        videoIndex: videos?.find(v => v.id === c.video_id)?.video_index || 0,
        clipIndex: c.clip_index,
        url: c.clip_url,
      })) || [],
    });

  } catch (error) {
    console.error("[video-batch-zip] Error:", error);
    return err(error instanceof Error ? error.message : "Internal error", 500);
  }
});
