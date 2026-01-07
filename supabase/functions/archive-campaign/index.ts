import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "jszip";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const ALLOWED_ORIGINS = [
  "https://alfie-designer.com",
  "https://alfie-designer.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

async function downloadFile(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file ${url} (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaign_id: campaignId } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!campaignId || !authHeader) {
      return new Response(JSON.stringify({ ok: false, message: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("[archive-campaign] Unauthorized", userError);
      return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (campaignError || !campaign) {
      console.error("[archive-campaign] Campaign not found or not owned", campaignError);
      return new Response(JSON.stringify({ ok: false, message: "Campagne introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assets, error: assetError } = await supabase
      .from("assets")
      .select("id, file_urls, type")
      .eq("campaign_id", campaignId)
      .eq("status", "ready");

    if (assetError) {
      console.error("[archive-campaign] Failed to load assets", assetError);
      throw assetError;
    }

    const fileUrls = (assets || [])
      .flatMap((asset) => asset.file_urls || [])
      .filter(Boolean);

    if (!fileUrls.length) {
      return new Response(JSON.stringify({ ok: false, message: "Aucun asset prêt à être archivé" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[archive-campaign] Building zip for campaign ${campaignId} with ${fileUrls.length} files`);
    const zip = new JSZip();

    let index = 1;
    for (const url of fileUrls) {
      try {
        const data = await downloadFile(url as string);
        const extMatch = (url as string).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        const ext = extMatch ? extMatch[1] : "png";
        const filename = `asset-${index}.${ext}`;
        zip.file(filename, data);
        console.log(`[archive-campaign] Added ${filename}`);
        index += 1;
      } catch (error) {
        console.error(`[archive-campaign] Failed to add ${url}`, error);
      }
    }

    const zipContent = await zip.generateAsync({ type: "uint8array" });
    const path = `campaign-assets/${campaignId}/campaign-${campaignId}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("campaign-assets")
      .upload(path, zipContent, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      console.error("[archive-campaign] Upload failed", uploadError);
      throw uploadError;
    }

    const { data: signedUrl, error: signedError } = await supabase.storage
      .from("campaign-assets")
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    if (signedError || !signedUrl) {
      console.error("[archive-campaign] Failed to create signed URL", signedError);
      throw signedError || new Error("Impossible de créer l'URL signée");
    }

    console.log(`[archive-campaign] Archive ready for campaign ${campaignId}: ${signedUrl.signedUrl}`);

    return new Response(JSON.stringify({ ok: true, url: signedUrl.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[archive-campaign] Error", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
    });
  }
});
