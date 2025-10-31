import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider, prompt, format, brand_id } = await req.json();

    console.log("[Alfie Render Image] Starting generation", { provider, prompt, format });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY manquant");

    // Call Lovable AI Gateway with Nano Banana (Gemini 2.5 Flash Image)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Alfie Render Image] AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Alfie Render Image] AI response received", { hasImages: !!data.choices?.[0]?.message?.images });

    const images = data.choices?.[0]?.message?.images;
    if (!images || images.length === 0) {
      throw new Error("Aucune image générée par l'IA");
    }

    const imageUrl = images[0].image_url?.url;
    if (!imageUrl) {
      throw new Error("URL d'image manquante dans la réponse IA");
    }

    console.log("[Alfie Render Image] Image generated successfully");

    // Store in media_generations
    const { data: generation, error: insertError } = await supabaseClient
      .from("media_generations")
      .insert({
        user_id: user.id,
        brand_id,
        type: "image",
        modality: "image",
        provider_id: provider,
        prompt,
        output_url: imageUrl,
        render_url: imageUrl,
        status: "completed",
        params_json: { format },
        metadata: { provider, format },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Alfie Render Image] Insert error:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        image_urls: [imageUrl],
        generation_id: generation.id,
        meta: { provider, format },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Alfie Render Image] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
