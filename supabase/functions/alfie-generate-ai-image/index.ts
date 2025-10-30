import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  templateImageUrl: string;
  brandKit?: {
    palette?: string[];
    logo_url?: string;
  };
  prompt?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateImageUrl, brandKit, prompt }: GenerateRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Construire le prompt pour la génération
    let fullPrompt = prompt || "Create a high-quality marketing visual based on the description";

    if (brandKit?.palette && brandKit.palette.length > 0) {
      fullPrompt += `. Use these brand colors: ${brandKit.palette.join(', ')}`;
    }

    // Construire le message en fonction de la présence d'une image modèle
    const userContent: any[] = [
      { type: "text", text: fullPrompt },
    ];

    if (templateImageUrl && typeof templateImageUrl === 'string' && templateImageUrl.trim().length > 0) {
      userContent.push({
        type: "image_url",
        image_url: { url: templateImageUrl }
      });
    }

    // Appel à l'API Lovable AI avec google/gemini-2.5-flash-image-preview
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "system",
            content: "You generate images only. Always return an image in message.images[0]. Never ask clarifying questions; infer missing details from the prompt and produce a single high-quality image."
          },
          {
            role: "user",
            content: userContent
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits. Please add credits to your workspace." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("API Response:", JSON.stringify(data, null, 2));
    
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("Full response data:", JSON.stringify(data, null, 2));
      // Retry once with a stronger directive to force image output
      const retry = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "system",
              content: "You are an image generator. Always produce exactly one image and include it in message.images[0]. Never ask questions or return text-only replies."
            },
            {
              role: "user",
              content: [
                { type: "text", text: `${fullPrompt}. Generate now.` },
                ...(templateImageUrl ? [{ type: "image_url", image_url: { url: templateImageUrl } }] : [])
              ]
            }
          ],
          modalities: ["image", "text"]
        })
      });

      const retryJson = await retry.json().catch(() => null);
      console.log("Retry API Response:", JSON.stringify(retryJson, null, 2));
      const retryUrl = retryJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!retryUrl) {
        throw new Error("No image generated");
      }

      return new Response(
        JSON.stringify({ imageUrl: retryUrl, message: retryJson?.choices?.[0]?.message?.content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        imageUrl: generatedImageUrl,
        message: data.choices?.[0]?.message?.content 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in alfie-generate-ai-image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
