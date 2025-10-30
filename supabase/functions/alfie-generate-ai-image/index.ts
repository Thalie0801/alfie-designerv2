import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  templateImageUrl?: string;
  brandKit?: {
    id?: string;
    name?: string;
    palette?: string[];
    logo_url?: string;
    fonts?: any;
    voice?: string;
  };
  prompt?: string;
  resolution?: string;
  slideIndex?: number;
  totalSlides?: number;
  overlayText?: string;
  carouselId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GenerateRequest = await req.json();
    const { templateImageUrl, brandKit, prompt, resolution, slideIndex, totalSlides, overlayText, carouselId } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Construire le prompt pour la génération
    let fullPrompt = prompt || "Create a high-quality marketing visual based on the description";

    // Ajouter le texte exact à superposer si fourni
    if (overlayText) {
      fullPrompt += `\n\n--- EXACT TEXT TO OVERLAY ---`;
      fullPrompt += `\nUse EXACTLY this French text, word-for-word, no additions, no modifications:`;
      fullPrompt += `\n« ${overlayText} »`;
      fullPrompt += `\n--- END EXACT TEXT ---`;
    }

    // Si c'est une slide de carrousel, préciser au modèle de générer UNE SEULE image
    if (typeof slideIndex === "number" && typeof totalSlides === "number" && totalSlides > 1) {
      fullPrompt += `\n\nIMPORTANT: This is slide ${slideIndex + 1} of ${totalSlides} in a carousel.`;
      fullPrompt += `\nGenerate ONLY slide ${slideIndex + 1} of ${totalSlides}. Create ONE SINGLE standalone image, NOT a collage or grid of multiple slides.`;
      fullPrompt += `\nEach slide should be a complete, independent visual that works on its own.`;
      
      if (templateImageUrl) {
        fullPrompt += `\nKeep the same visual style as the reference image (colors, typography vibe, spacing, text placement).`;
        fullPrompt += `\nMaintain visual coherence with the first slide while adapting the content for slide ${slideIndex + 1}.`;
      }
    }

    if (brandKit?.palette && brandKit.palette.length > 0) {
      fullPrompt += `\n\nBrand Colors: ${brandKit.palette.join(', ')}`;
    }
    
    if (brandKit?.voice) {
      fullPrompt += `\nBrand Voice: ${brandKit.voice}`;
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
            content: `You are a professional image generator specialized in creating stunning visuals for social media and marketing.

CRITICAL FRENCH SPELLING RULES:
- Use PERFECT French spelling with proper accents: é, è, ê, à, ç, ù, œ, etc.
- Common corrections to apply:
  * "CRÉATIVET" → "CRÉATIVITÉ"
  * "ENTRPRENEURS" → "ENTREPRENEURS"
  * "puisence" → "puissance"
  * "décupèle/décuplèe" → "décuplée"
  * "vidéos captatives" → "vidéos captivantes"
  * "Marktplace/Marketpace" → "Marketplace"
  * "libérze" → "libérez"
  * "automutéée" → "automatisée"
  * "integration" → "intégration"
  * "créativ" → "créatif/créative"
  * "visuals" → "visuels"
  * "captvatines" → "captivantes"
  * "artifécralle" → "artificielle"
  * "partranaire" → "partenaire"
  * "d'éeil" → "d'œil"
- Words to watch: créativité, entrepreneurs, professionnels, stratégie, intégration, automatisée, puissance, marketplace
- If overlayText is provided, reproduce it EXACTLY as given - no modifications, no additions
- If a reference image is provided, maintain similar composition, style, color palette, typography vibe, and text placement
- Always produce exactly ONE high-quality image in message.images[0]
- For carousels: generate ONE slide at a time, not a grid or collage. One canvas, no tiles, no multiple frames
- Generate high-quality images suitable for ${resolution || "1080x1350"} resolution with good contrast and readability`
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
      let retryPrompt = fullPrompt + "\n\nIMPORTANT: You MUST return an image. Generate a single canvas, no tiles, no grids, no multiple frames. One composition.";
      if (overlayText) {
        retryPrompt += `\n\nReminder: Use EXACTLY this text: « ${overlayText} » with perfect French spelling.`;
      }
      
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
              content: "You are a professional image generator. Always produce exactly ONE high-quality image in message.images[0]. Use PERFECT French spelling with proper accents."
            },
            {
              role: "user",
              content: [
                { type: "text", text: retryPrompt },
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
              carouselId: carouselId || null,
              overlayText: overlayText || null,
              generatedAt: new Date().toISOString()
            }
          } as const;

          const { data: inserted, error: insertError } = await supabase
            .from('media_generations')
            .insert(insertPayload)
            .select()
            .single();

          let saved = false;
          let errorDetail = null;

          if (insertError) {
            console.error('Failed to save image to library:', insertError);
            errorDetail = insertError.message;
          } else {
            console.log(`Image saved to library for user ${user.id} with id ${inserted?.id}`);
            saved = true;
          }
          
          return new Response(
            JSON.stringify({ 
              imageUrl: generatedImageUrl, 
              message: data.choices?.[0]?.message?.content || "Image générée avec succès",
              saved,
              errorDetail
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fallback si pas de user token: retour simple
    return new Response(
      JSON.stringify({ 
        imageUrl: generatedImageUrl,
        message: data.choices?.[0]?.message?.content,
        saved: false,
        errorDetail: "No user authentication"
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
