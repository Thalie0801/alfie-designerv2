// supabase/functions/video-batch-csv/index.ts
// GET /video-batches/:id/csv - Export CSV for Canva Bulk Create

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const supabaseAdmin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get batchId from URL or body
    const url = new URL(req.url);
    let batchId = url.searchParams.get("batchId");
    
    if (!batchId && req.method === "POST") {
      const body = await req.json();
      batchId = body.batchId;
    }

    if (!batchId) {
      return new Response(JSON.stringify({ error: "Missing batchId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[video-batch-csv] Exporting CSV for batch ${batchId}`);

    // Verify batch ownership
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("video_batches")
      .select("id, user_id")
      .eq("id", batchId)
      .eq("user_id", user.id)
      .single();

    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get videos with texts
    const { data: videos } = await supabaseAdmin
      .from("batch_videos")
      .select("id, video_index, title")
      .eq("batch_id", batchId)
      .order("video_index", { ascending: true });

    const videoIds = videos?.map(v => v.id) || [];

    const { data: texts } = await supabaseAdmin
      .from("batch_video_texts")
      .select("*")
      .in("video_id", videoIds.length ? videoIds : ["00000000-0000-0000-0000-000000000000"]);

    // Build CSV
    // Columns: batch_key,video_index,video_title,clip1_title,clip1_subtitle,clip2_title,clip2_subtitle,clip3_title,clip3_subtitle,cta
    const headers = "batch_key,video_index,video_title,clip1_title,clip1_subtitle,clip2_title,clip2_subtitle,clip3_title,clip3_subtitle,cta";
    
    const rows = videos?.map(video => {
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

    const csv = `${headers}\n${rows.join("\n")}`;
    const csvWithBOM = "\uFEFF" + csv; // UTF-8 BOM for Excel compatibility

    console.log(`[video-batch-csv] Generated CSV with ${rows.length} rows`);

    return new Response(csvWithBOM, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="batch-${batchId.slice(0, 8)}-canva.csv"`,
      },
    });

  } catch (error) {
    console.error("[video-batch-csv] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
