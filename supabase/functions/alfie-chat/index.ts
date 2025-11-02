import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userHasAccess } from "../_shared/accessControl.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration flexible du modèle IA (facile à changer)
const AI_CONFIG = {
  model: Deno.env.get("ALFIE_AI_MODEL") || "google/gemini-2.5-flash",
  endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier l'accès (Stripe OU granted_by_admin)
    const hasAccess = await userHasAccess(req.headers.get('Authorization'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { messages, brandId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Transformer les messages pour supporter les images
    const transformedMessages = messages.map((msg: any) => {
      if (msg.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.imageUrl } }
          ]
        };
      }
      return msg;
    });

    const systemPrompt = `Tu es Alfie. Tu gères 3 intentions : image, carrousel, vidéo.
Règle d'or : 2 messages de clarification MAX, puis tu exécutes.

Toujours demander/figer : canal/ratio, objectif, style=brand, texte/hook si utile.
Toutes les générations doivent être taggées avec user_id et brand_id.
Chemins de stockage : 
- image → generated/<user_id>/<brand_id>/<ts>-<uuid>.png
- carrousel → carousel/<brand_id>/<job_set_id>/slide_<i>_<ts>.png
- vidéo → video/<brand_id>/<uuid>.mp4

Si info critique manque après 2 messages → proposer un mini-brief par défaut et exécuter.
Réponses brèves, choix fermés. Pas de pavé.

---
ROUTER (ultra-simple)
---
Si phrase contient "carrousel|carousel|slides" → CARROUSEL
Si "vidéo|video|reel|short|story vidéo" → VIDÉO
Sinon si "image|visuel|cover|miniature" → IMAGE
Sinon → demander : "Tu veux une image, un carrousel ou une vidéo ?"

---
IMAGE (2 messages → run)
---
Msg 1 : « Pour l'image : quel canal/format (1:1, 9:16, 16:9) et l'objectif (promo, éducatif, annonce) ? Style marque ok ? »
Msg 2 : « Je pars sur {canal/ratio}, style marque, objectif {x}. Un titre/texte à intégrer ? (oui/non) »

Puis RUN : generate_image avec {brand_id, channel, ratio, objective, style:"brand", text_overlay}

---
CARROUSEL (2 messages → plan validé → run)
---
Msg 1 : « Carrousel. Canal (LinkedIn/IG), objectif (éduquer/annoncer/lead-gen), #slides (5 par défaut) ? »
Msg 2 : « Plan :
Hook (S1) : …
S2…S{N-1} : idée + 2 bullets
S{N} : CTA
Je lance là-dessus ? (oui/non) »

Puis RUN : plan_carousel puis generate_carousel_slide pour chaque slide après validation.
Sortie : carousel/<brand_id>/<job_set_id>/slide_<i>_<ts>.png

---
VIDÉO (2 messages → script validé → run)
---
Msg 1 : « Vidéo : durée (10–15s ou 30–60s), ratio (9:16/1:1/16:9), objectif (teaser/éducatif/promo) ? »
Msg 2 : « Script + shots ok : Hook → Corps → CTA. Sous-titres + musique neutre ? (oui/non) Je lance ? »

Puis RUN : generate_video avec {brand_id, duration_sec, ratio, script, subtitles, music}

---
QUOTAS
---
- Starter : 150 visuals, 15 Woofs/mois
- Pro : 450 visuals, 45 Woofs/mois
- Studio : 1000 visuals, 100 Woofs/mois

Si quota insuffisant → "❌ Quota insuffisant. Il te reste {remaining}. Upgrade ?"
Si pas de brand_id → "⚠️ Aucune marque active. Sélectionne d'abord une marque."

---
STYLE
---
- Texte brut, pas de Markdown (**, __, *, #)
- Emojis avec modération : 🐾 ✨ 🎨 💡 🪄
- Tutoiement naturel, pas robotique
- Réponses brèves, choix fermés`;

    const tools = [
      {
        type: "function",
        function: {
          name: "browse_templates",
          description: "Search for Canva templates based on criteria like category, keywords, or ratio",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Template category/niche (e.g., 'social_media', 'marketing')" },
              keywords: { type: "string", description: "Keywords to search for in template titles/descriptions" },
              ratio: { type: "string", description: "Aspect ratio (e.g., '1:1', '16:9', '9:16', '4:5')" },
              limit: { type: "number", description: "Maximum number of results (default: 5)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_brandkit",
          description: "Show the user's current Brand Kit (colors, logo, fonts)",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "open_canva",
          description: "Open a Canva template or import a generated image into Canva",
          parameters: {
            type: "object",
            properties: {
              template_url: { type: "string", description: "The Canva template URL to open (if using existing template)" },
              generated_image_url: { type: "string", description: "The generated image URL to import into Canva (if using AI-generated image)" },
              template_title: { type: "string", description: "The template title for confirmation" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_ai_version",
          description: "Generate an AI-styled version of a template using Nano-Banana (costs 1 credit)",
          parameters: {
            type: "object",
            properties: {
              template_image_url: { type: "string", description: "URL of the template image to transform" },
              template_title: { type: "string", description: "Template title for reference" },
              style_instructions: { type: "string", description: "Specific style adjustments to apply" }
            },
            required: ["template_image_url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_credits",
          description: "Check the user's remaining AI generation credits",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_image",
          description: "Generate an image from a text prompt (1 crédit). Supports different aspect ratios for social media.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Detailed description of the image to generate" },
              aspect_ratio: { 
                type: "string", 
                description: "Aspect ratio for the image (default: 1:1). Options: 1:1 (Instagram post), 4:5 (Instagram portrait), 9:16 (Instagram story/TikTok), 16:9 (YouTube/Twitter)", 
                enum: ["1:1", "4:5", "9:16", "16:9"]
              }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "improve_image",
          description: "Improve an existing image with AI (1 crédit). User must provide image URL.",
          parameters: {
            type: "object",
            properties: {
              image_url: { type: "string", description: "URL of the image to improve" },
              instructions: { type: "string", description: "Specific improvements to apply" }
            },
            required: ["image_url", "instructions"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_video",
          description: "Generate a video from a text prompt. Uses Sora2 → Seededance → Kling fallback. Cost: 1 Woof per video (5-15s). For >15s, suggest multi-clip approach.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Detailed description of the video to generate (in English for best quality)" },
              aspectRatio: { type: "string", description: "Video aspect ratio: '16:9' (landscape) or '9:16' (portrait). Default: '16:9'" },
              imageUrl: { type: "string", description: "Optional: URL of uploaded image to use as video base (image→video)" }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_usage",
          description: "Show the user's current quota usage (visuals, videos, Woofs) for their active brand",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "adapt_template",
          description: "Apply Brand Kit to a Canva template (colors, logo, fonts). FREE, not counted in quotas.",
          parameters: {
            type: "object",
            properties: {
              template_id: { type: "string", description: "Canva template ID" },
              template_title: { type: "string", description: "Template title for confirmation" }
            },
            required: ["template_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "package_download",
          description: "Prepare a ZIP package with download links for user's generated assets",
          parameters: {
            type: "object",
            properties: {
              asset_ids: { type: "array", items: { type: "string" }, description: "Asset IDs to include in package (optional, all if empty)" },
              filter_type: { type: "string", description: "Filter by type: 'images', 'videos', or 'all' (default)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "plan_carousel",
          description: "Generate a structured text plan for a carousel (returns JSON with all slides content, no images generated yet)",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Carousel theme/objective in English" },
              count: { type: "number", description: "Number of slides (default: 5)" },
              aspect_ratio: { type: "string", description: "Aspect ratio: '1:1' or '4:5'" }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_carousel_slide",
          description: "Generate a single carousel slide image from validated text content",
          parameters: {
            type: "object",
            properties: {
              slideIndex: { type: "number", description: "Index of the slide (0-based)" },
              slideContent: { 
                type: "object", 
                description: "Validated slide content (title, subtitle, bullets, kpis)" 
              },
              aspect_ratio: { type: "string", description: "Aspect ratio: '1:1' or '4:5'" }
            },
            required: ["slideIndex", "slideContent"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "classify_intent",
          description: "Classify user request into intent: image, carousel, video, or other",
          parameters: {
            type: "object",
            properties: {
              user_message: { type: "string", description: "User's raw message" }
            },
            required: ["user_message"]
          }
        }
      }
    ];

    const response = await fetch(AI_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.model, // Modèle configurable via env variable
        messages: [
          { role: "system", content: systemPrompt },
          ...transformedMessages
        ],
        tools: tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédit insuffisant. Contactez le support." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
    });
  } catch (error) {
    console.error("Error in alfie-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
