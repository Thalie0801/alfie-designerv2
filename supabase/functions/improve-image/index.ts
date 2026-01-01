import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  LOVABLE_API_KEY,
  validateEnv,
} from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageUrl, prompt } = await req.json();

    if (!imageUrl || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: imageUrl and prompt" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Improving image with prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const improvedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!improvedImageUrl) {
      throw new Error("No image generated");
    }

    let finalUrl = improvedImageUrl;
    try {
      const supabaseUrl = SUPABASE_URL;
      const supabaseKey = SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const assetClient = createClient(supabaseUrl, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const assetResponse = await fetch(improvedImageUrl);
        if (assetResponse.ok) {
          const arrayBuffer = await assetResponse.arrayBuffer();
          const contentType = assetResponse.headers.get("content-type") || "image/png";
          const filePath = `improved/${crypto.randomUUID()}.png`;

          const { error: uploadError } = await assetClient.storage
            .from("assets")
            .upload(filePath, new Uint8Array(arrayBuffer), {
              contentType,
              upsert: false,
            });

          if (!uploadError) {
            const { data: publicUrl } = assetClient.storage.from("assets").getPublicUrl(filePath);
            if (publicUrl?.publicUrl) {
              finalUrl = publicUrl.publicUrl;
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to persist improved image to storage:", e);
    }

    return new Response(
      JSON.stringify({ url: finalUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[improve-image] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
