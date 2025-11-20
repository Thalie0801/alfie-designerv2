import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

async function fetchGeneratedImage(prompt: string, apiKey: string) {
  const apiUrl = Deno.env.get("IMAGE_API_URL") || "https://image.pollinations.ai/prompt/";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt, size: "1024x1024" }),
  });

  if (!response.ok) {
    console.warn("[campaign-generate-image] Primary provider failed, falling back to GET", response.status);
    const fallback = await fetch(`${apiUrl}${encodeURIComponent(prompt)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!fallback.ok) {
      throw new Error(`Image provider error (${response.status})`);
    }
    return fallback.arrayBuffer();
  }

  return response.arrayBuffer();
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const imageApiKey = Deno.env.get("NANO_BANANA_KEY") || Deno.env.get("IMAGE_API_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!imageApiKey) {
      throw new Error("Missing image API key (NANO_BANANA_KEY or IMAGE_API_KEY)");
    }

    const { asset_id: assetId } = await req.json();
    if (!assetId) {
      return new Response(JSON.stringify({ ok: false, message: "asset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      console.error("[campaign-generate-image] Asset not found", assetError);
      throw new Error("Asset introuvable");
    }

    if (asset.type !== "image") {
      throw new Error("Seuls les assets image peuvent être générés");
    }

    const campaignId = asset.campaign_id;
    const config = typeof asset.config === "string" ? JSON.parse(asset.config) : asset.config || {};
    const brandKit = config.brandKit || {};
    const topic = config.topic || config.title || "Visuel Alfie";

    const promptParts = [
      `Sujet: ${topic}`,
      "Style: 3D, clean, premium, format 1:1, sans texte lisible",
    ];

    if (brandKit.primary_color || brandKit.secondary_color) {
      promptParts.push(
        `Couleurs de marque: ${[brandKit.primary_color, brandKit.secondary_color]
          .filter(Boolean)
          .join(", ")}`,
      );
    }

    const prompt = promptParts.join(" | ");

    console.log("[campaign-generate-image] Generating", { assetId, campaignId, prompt });

    await supabase
      .from("assets")
      .update({ status: "generating" })
      .eq("id", assetId);

    const arrayBuffer = await fetchGeneratedImage(prompt, imageApiKey);

    const filePath = `campaign-assets/${campaignId}/images/${assetId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("campaign-assets")
      .upload(filePath, new Uint8Array(arrayBuffer), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[campaign-generate-image] Upload failed", uploadError);
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from("campaign-assets")
      .getPublicUrl(filePath);

    const fileUrls = [publicUrl.publicUrl];

    const { error: updateError } = await supabase
      .from("assets")
      .update({ status: "ready", file_urls: fileUrls })
      .eq("id", assetId);

    if (updateError) {
      console.error("[campaign-generate-image] Failed to update asset", updateError);
      throw updateError;
    }

    console.log("[campaign-generate-image] Done", { assetId, campaignId, filePath });

    return new Response(
      JSON.stringify({ ok: true, asset_id: assetId, file_urls: fileUrls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[campaign-generate-image] Error", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" },
    });
  }
});
