import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface GenerateCarouselRequest {
  asset_id: string;
}

interface CarouselSlide {
  heading: string;
  body: string;
}

interface CarouselData {
  title: string;
  slides: CarouselSlide[];
  cta?: string;
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
    const body: GenerateCarouselRequest = await req.json();
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
      console.error("[campaign-generate-carousel] User auth error:", userError);
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[campaign-generate-carousel] Generating carousel for asset:", asset_id);

    // Fetch asset
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*, campaigns!inner(user_id)")
      .eq("id", asset_id)
      .single();

    if (assetError || !asset) {
      console.error("[campaign-generate-carousel] Asset not found:", assetError);
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

    // Check if asset is of type carousel
    if (asset.type !== "carousel") {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "invalid_asset_type",
          message: "This function only handles carousel assets" 
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
    const { topic, slides: slideCount = 5, brandKit } = config;

    if (!topic) {
      await supabase
        .from("assets")
        .update({ 
          status: "failed",
          error_message: "Missing topic in config"
        })
        .eq("id", asset_id);

      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "missing_topic",
          message: "Asset config must include a topic" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[campaign-generate-carousel] Topic:", topic, "Slides:", slideCount);

    // Generate carousel content using LLM
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[campaign-generate-carousel] Missing OPENAI_API_KEY");
      await supabase
        .from("assets")
        .update({ 
          status: "failed",
          error_message: "Missing API key"
        })
        .eq("id", asset_id);

      return new Response(
        JSON.stringify({ ok: false, error: "missing_api_key" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build LLM prompt
    const systemPrompt = `Tu es un expert en création de carrousels pour les réseaux sociaux.
Tu dois créer un carrousel de ${slideCount} slides sur le sujet : "${topic}".

Structure recommandée :
- Slide 1 : Hook accrocheur (titre qui capte l'attention)
- Slides 2-${slideCount - 1} : Contenu principal (problème, solution, étapes, bénéfices)
- Slide ${slideCount} : CTA (appel à l'action)

Règles :
- Chaque slide doit avoir un heading court (max 50 caractères)
- Le body doit être concis (1-2 phrases, max 150 caractères)
- Utilise un ton ${brandKit?.tone || "professionnel et engageant"}
- Adapte le contenu pour ${brandKit?.niche || "un public général"}

Réponds UNIQUEMENT avec un JSON valide au format :
{
  "title": "Titre accrocheur du carrousel",
  "slides": [
    { "heading": "Titre slide 1", "body": "Contenu slide 1" },
    { "heading": "Titre slide 2", "body": "Contenu slide 2" }
  ],
  "cta": "Appel à l'action final"
}`;

    const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Crée un carrousel de ${slideCount} slides sur : ${topic}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
    });

    if (!llmResponse.ok) {
      const errorData = await llmResponse.json();
      console.error("[campaign-generate-carousel] LLM error:", errorData);
      
      await supabase
        .from("assets")
        .update({ 
          status: "failed",
          error_message: "LLM generation failed"
        })
        .eq("id", asset_id);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "llm_failed",
          message: errorData.error?.message || "Failed to generate carousel content",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const llmResult = await llmResponse.json();
    const carouselContent = JSON.parse(llmResult.choices[0].message.content);

    console.log("[campaign-generate-carousel] Generated content:", carouselContent);

    // Validate carousel content
    if (!carouselContent.title || !Array.isArray(carouselContent.slides)) {
      await supabase
        .from("assets")
        .update({ 
          status: "failed",
          error_message: "Invalid carousel content format"
        })
        .eq("id", asset_id);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "invalid_content",
          message: "Generated content is not in the expected format",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update asset with carousel data
    const updatedConfig = {
      ...config,
      carouselData: carouselContent,
    };

    const { error: updateError } = await supabase
      .from("assets")
      .update({
        status: "ready",
        config: updatedConfig,
        error_message: null,
      })
      .eq("id", asset_id);

    if (updateError) {
      console.error("[campaign-generate-carousel] Failed to update asset:", updateError);
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

    console.log("[campaign-generate-carousel] Asset updated successfully");

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        asset_id,
        carousel_data: carouselContent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[campaign-generate-carousel] Unexpected error:", error);
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
