import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  templateImageUrl: string;
  brandKit?: {
    id?: string;
    name?: string;
    palette?: string[];
    logo_url?: string;
  };
  prompt?: string;
  resolution?: string;
  slideIndex?: number;
  totalSlides?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GenerateRequest = await req.json();
    const { templateImageUrl, brandKit, prompt, resolution, slideIndex, totalSlides } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Construire le prompt pour la génération
    let fullPrompt = prompt || "Create a high-quality marketing visual based on the description";

    // Si c'est une slide de carrousel, préciser au modèle de générer UNE SEULE image
    if (typeof slideIndex === "number" && typeof totalSlides === "number" && totalSlides > 1) {
      fullPrompt = `IMPORTANT: Generate ONLY slide ${slideIndex + 1} of ${totalSlides}. 
Create ONE SINGLE standalone image, NOT a collage or grid of multiple slides.
This is slide ${slideIndex + 1}/${totalSlides} of a carousel.

${fullPrompt}`;
    }

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
            content: "You are a professional image generator. Always produce exactly ONE high-quality image in message.images[0]. Never ask questions or return text-only replies.\n\nCRITICAL: When generating text overlays in French, use PERFECT French spelling and grammar. Double-check all accents (é, è, ê, à, ç, ï, ü) and avoid common mistakes like 'CRÉATIVET' (should be 'CRÉATIVITÉ'), 'ENTRPRENEURS' (should be 'ENTREPRENEURS'). Pay special attention to: créativité, entrepreneurs, opportunités, qualité, succès, stratégie."
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
    
    let generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

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
              content: "You are a professional image generator. Always produce exactly ONE high-quality image in message.images[0]. Never ask questions or return text-only replies.\n\nCRITICAL: When generating text overlays in French, use PERFECT French spelling and grammar. Double-check all accents (é, è, ê, à, ç, ï, ü) and avoid common mistakes."
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

      generatedImageUrl = retryUrl;
    }

    // Sauvegarder en bibliothèque (Phase 4)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseKey) {
      const authHeader = req.headers.get("Authorization")?.replace("Bearer", "").trim();
      if (authHeader) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { user } } = await supabase.auth.getUser(authHeader);
        
        if (user) {
          const brandId = typeof brandKit?.id === "string" ? brandKit.id : null;
          const slideIdx = typeof slideIndex === "number" ? slideIndex : null;
          const totalSlidesVal = typeof totalSlides === "number" ? totalSlides : null;
          
          const insertPayload = {
            user_id: user.id,
            brand_id: brandId,
            type: 'image',
            status: 'completed',
            prompt: fullPrompt.substring(0, 500),
            output_url: generatedImageUrl,
            thumbnail_url: generatedImageUrl,
            woofs: 1,
            metadata: {
              resolution: resolution || "1080x1350",
              brandName: brandKit?.name,
              slideIndex: slideIdx,
              totalSlides: totalSlidesVal,
              generatedAt: new Date().toISOString()
            }
          } as const;

          const { data: inserted, error: insertError } = await supabase
            .from('media_generations')
            .insert(insertPayload)
            .select()
            .single();

          if (insertError) {
            console.error('Failed to save image to library:', insertError);
          } else {
            console.log(`Image saved to library for user ${user.id} with id ${inserted?.id}`);
          }
          
          console.log(`Image saved to library for user ${user.id}`);
        }
      }
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
