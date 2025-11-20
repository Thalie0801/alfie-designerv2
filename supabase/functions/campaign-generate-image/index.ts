import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface GenerateImageRequest {
  asset_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse request
    const body: GenerateImageRequest = await req.json();
    const { asset_id } = body;

    if (!asset_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_asset_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[campaign-generate-image] User auth error:", userError);
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[campaign-generate-image] Generating image for asset:", asset_id);

    // Fetch asset
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*, campaigns!inner(user_id)")
      .eq("id", asset_id)
      .single();

    if (assetError || !asset) {
      console.error("[campaign-generate-image] Asset not found:", assetError);
      return new Response(
        JSON.stringify({ ok: false, error: "asset_not_found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify ownership
    if (asset.campaigns.user_id !== user.id) {
      return new Response(
        JSON.stringify({ ok: false, error: "forbidden" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if asset is of type image
    if (asset.type !== "image") {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "invalid_asset_type",
          message: "This function only handles image assets" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update status to generating
    await supabase
      .from("assets")
      .update({ status: "generating" })
      .eq("id", asset_id);

    // Extract config
    const config = asset.config || {};
    const { prompt, topic, brandKit } = config;
    const imagePrompt = prompt || topic || "Create a high-quality marketing visual";

    // Build enhanced prompt with brand kit
    let enhancedPrompt = imagePrompt;
    
    if (brandKit) {
      const { primary_color, secondary_color, tone } = brandKit;
      
      enhancedPrompt = `${imagePrompt}

Style: ${tone || "modern, professional"}
Color palette: ${primary_color || "vibrant"}, ${secondary_color || "complementary"}
Format: 1:1 for social media
High quality, engaging, professional composition`;
    }

    console.log("[campaign-generate-image] Enhanced prompt:", enhancedPrompt);

    // Call the existing alfie-generate-ai-image function
    const imageGenResponse = await fetch(
      `${supabaseUrl}/functions/v1/alfie-generate-ai-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          userId: user.id,
          prompt: enhancedPrompt,
          resolution: "1080x1080",
          brandKit: brandKit || undefined,
        }),
      }
    );

    if (!imageGenResponse.ok) {
      const errorData = await imageGenResponse.json();
      console.error("[campaign-generate-image] Image generation failed:", errorData);
      
      // Update asset status to failed
      await supabase
        .from("assets")
        .update({ 
          status: "failed",
          error_message: errorData.error || "Image generation failed"
        })
        .eq("id", asset_id);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "image_generation_failed",
          message: errorData.error || "Failed to generate image",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const imageResult = await imageGenResponse.json();
    console.log("[campaign-generate-image] Image generated:", imageResult);

    // Extract image URL from result
    const imageUrl = imageResult.url || imageResult.imageUrl;

    if (!imageUrl) {
      console.error("[campaign-generate-image] No image URL in response");
      
      await supabase
        .from("assets")
        .update({ 
          status: "failed",
          error_message: "No image URL returned from generation"
        })
        .eq("id", asset_id);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "no_image_url",
          message: "Image generation did not return a URL",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update asset with image URL and set status to ready
    const { error: updateError } = await supabase
      .from("assets")
      .update({
        status: "ready",
        file_urls: [imageUrl],
        error_message: null,
      })
      .eq("id", asset_id);

    if (updateError) {
      console.error("[campaign-generate-image] Failed to update asset:", updateError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "update_failed",
          message: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[campaign-generate-image] Asset updated successfully");

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        asset_id,
        image_url: imageUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[campaign-generate-image] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
