import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateContentRequest {
  type: 'image' | 'video';
  prompt: string;
  brandKit?: {
    palette?: string[];
    logo_url?: string;
  };
  // Options pour les vidéos
  duration?: number; // 5 ou 8 secondes
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, prompt, brandKit, duration: _duration, aspectRatio: _aspectRatio }: GenerateContentRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`🎨 Generating ${type} with prompt:`, prompt);

    if (type === 'image') {
      // Génération d'image avec l'IA
      let fullPrompt = prompt;
      
      if (brandKit?.palette && brandKit.palette.length > 0) {
        fullPrompt += `. Use these brand colors: ${brandKit.palette.join(', ')}. Create a professional social media ready design.`;
      }

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
              role: "user",
              content: fullPrompt
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
            JSON.stringify({ error: "Trop de requêtes, patiente un instant !" }), 
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Crédits insuffisants sur ton workspace Lovable." }), 
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        throw new Error("Aucune image générée");
      }

      return new Response(
        JSON.stringify({ 
          contentUrl: imageUrl,
          type: 'image',
          message: data.choices?.[0]?.message?.content 
        }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (type === 'video') {
      // Génération de vidéo avec VEO3 (Google Video Model)
      // Note: VEO3 n'est pas encore disponible via Lovable AI Gateway
      // On prépare l'infrastructure pour quand ce sera disponible
      
      return new Response(
        JSON.stringify({ 
          error: "La génération vidéo VEO3 n'est pas encore disponible. Elle sera ajoutée prochainement ! 🎥",
          status: "coming_soon"
        }), 
        { 
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    throw new Error("Type de contenu invalide");

  } catch (error) {
    console.error("Error in generate-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});