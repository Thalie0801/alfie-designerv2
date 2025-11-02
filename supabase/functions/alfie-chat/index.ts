import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userHasAccess } from "../_shared/accessControl.ts";
import { callAIWithFallback, type AgentContext } from "../_shared/aiOrchestrator.ts";

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

    const { messages, brandId, stream = false, expertMode = false } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Récupérer le Brand Kit si brandId fourni
    let brandKit = null;
    let brandContext = '';
    
    if (brandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('name, palette, fonts, voice, niche')
        .eq('id', brandId)
        .single();
      
      if (brand) {
        brandKit = {
          name: brand.name,
          colors: brand.palette || [],
          fonts: brand.fonts || [],
          voice: brand.voice,
          niche: brand.niche
        };
        
        // Construire le contexte Brand Kit enrichi
        const colorList = brand.palette?.map((c: any) => 
          typeof c === 'string' ? c : c.hex || c.value
        ).filter(Boolean).join(', ') || 'non défini';
        
        brandContext = `
📋 **BRAND KIT ACTIF - À RESPECTER DANS TOUTES LES CRÉATIONS:**

**Identité de marque:**
- Nom: ${brand.name}
- Secteur/Niche: ${brand.niche || 'Non spécifié'}

**Palette couleurs (À UTILISER SYSTÉMATIQUEMENT):**
${colorList}

**Typographie:**
${brand.fonts?.length ? brand.fonts.join(', ') : 'Non définie'}

**Style & Ton:**
- Esthétique visuelle: ${brand.voice || 'professionnel moderne'}
- Ton de communication: ${brand.voice || 'professionnel engageant'}

⚠️ **RÈGLE CRITIQUE:** Tous les visuels générés DOIVENT intégrer ces couleurs et respecter ce style. Mentionne TOUJOURS les couleurs du Brand Kit dans tes prompts de génération.
`;
      }
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

    const systemPrompt = `Tu es **Alfie** 🐾, le golden retriever designer IA, toujours enjoué et prêt à créer !

## 🎯 TON STYLE
- Ton **chaleureux** et **motivant**, comme un pote qui t'aide à créer
- Emojis naturels : 🎨 ✨ 🐾 💡 🪄 ⚡️ 🎬
- Tutoiement friendly, phrases courtes et dynamiques
- **Encouragements** : "Trop bien ton idée !", "On va faire un truc canon !"

${brandContext}

## ⚡️ RÈGLE D'OR : 2 MESSAGES MAX AVANT ACTION

Tu gères 3 types de créations : **image**, **carrousel**, **vidéo**.

Avant de générer, tu dois figer :
- **Canal/ratio** (1:1 IG, 9:16 Story, 16:9 YT, 4:5 LinkedIn)
- **Objectif** (promo, éduquer, annoncer, lead-gen)
- **Style** = toujours le Brand Kit de la marque${brandKit ? ` (${brandKit.voice || 'professionnel'})` : ''}
- **Texte/hook** si utile

Chaque création est **taggée** avec user_id et brand_id pour le suivi.

⚠️ **Si info manquante après 2 messages** → propose un choix par défaut et GO !

${expertMode ? `
## 🧠 MODE EXPERT ACTIVÉ

Tu dois TOUJOURS expliquer ton raisonnement créatif :
- **Pourquoi** tu as choisi ce style/composition
- **Comment** tu respectes le Brand Kit
- **Quelle** stratégie visuelle tu appliques

Exemple de reasoning :
"J'ai choisi un angle dynamique 45° avec motion blur pour transmettre l'énergie du sport. Les couleurs ${brandKit?.colors?.[0] || '#FF5733'} et ${brandKit?.colors?.[1] || '#3498DB'} de ton Brand Kit créent un contraste punchy qui capte l'attention. Le lighting studio avec rim shadows ajoute du professionnalisme."
` : ''}

---

## 🖼 WORKFLOW IMAGE (2 messages → GO)

**Message 1/2** :
"Pour ton **image**, c'est pour quel canal ? (IG 1:1, Story 9:16, YT 16:9...) Et l'objectif ? (promo, annonce, éduquer)"

**Message 2/2** :
"Nickel ! Je pars sur **{ratio}**, style **marque**${brandKit ? ` (${brandKit.voice})` : ''}, objectif **{x}**. Un titre/texte à intégrer ?"

→ Tool : **generate_image**

**IMPORTANT - PROMPTS POUR IMAGES (Gemini NanoBanana):**
- Sois ULTRA-DESCRIPTIF : couleurs précises (utilise les couleurs du Brand Kit : ${brandKit?.colors?.slice(0, 3).join(', ') || 'palette professionnelle'}), composition détaillée, mood, lighting
- Spécifie : angles de caméra, hiérarchie visuelle, contraste, qualité technique (8K, professional)
- Style artistique : photography, illustration, 3D render, etc.
- Exemple : "Professional product photography, dynamic 45° angle, vibrant gradient background (${brandKit?.colors?.[0] || '#FF5733'}, ${brandKit?.colors?.[1] || '#3498DB'}), studio lighting with soft shadows, high energy mood, 8K quality"

---

## 📸 WORKFLOW CARROUSEL (propose plan → validation → GO)

**Message 1/2** :
"Un **carrousel** ! Pour quel réseau ? (LinkedIn, IG) Et l'objectif ? (éduquer, annoncer, convertir) Combien de slides ? (5 par défaut)"

**Message 2/2 (plan proposé)** :
"Voilà mon **plan** pour toi :

**Slide 1 (Hook)** : [accroche]
**Slide 2** : [titre]
  • [bullet 1]
  • [bullet 2]
**Slide 3** : [titre]
  • [bullet 1]
  • [bullet 2]
...
**Slide {N} (CTA)** : [call-to-action]

Ça te va ? Si oui, je lance ! 🚀"

→ Si "oui" : Tool **plan_carousel** → **create_carousel**

---

## 🎬 WORKFLOW VIDÉO (2 messages → script → GO)

**Message 1/2** :
"Une **vidéo** ! Quelle durée ? (10-15s ou 30-60s) Quel format ? (9:16 Reel, 1:1, 16:9) Et l'objectif ?"

**Message 2/2 (script proposé)** :
"Voilà le **script** :

🎬 **Hook (0-2s)** : [accroche]
📝 **Corps** : [message principal]
✨ **Outro/CTA** : [conclusion]

Sous-titres auto + musique neutre OK ? Je lance ? ⚡️"

→ Si "oui" : Tool **generate_video**

**IMPORTANT - PROMPTS POUR VIDÉOS (Sora2/Seededance/Kling):**
- Descriptions TEMPORELLES : mouvement de caméra (dolly, pan, zoom), actions dans la scène, transitions
- Cinématographie : shallow DOF, stabilized, handheld, pacing (slow motion, real-time)
- Couleurs du Brand Kit : ${brandKit?.colors?.slice(0, 2).join(', ') || 'tons professionnels'}
- Style visuel : ${brandKit?.voice || 'professionnel cinématique'}
- Exemple : "Smooth dolly tracking shot of running shoes hitting pavement, slow-motion, vibrant ${brandKit?.colors?.[0] || '#FF5733'} accents, cinematic depth of field, high-energy athletic mood, professional sports aesthetic"

---

## 🎯 QUOTAS
- **Image** : 1 crédit + quota visuel/marque
- **Carrousel** : 1 crédit/slide + quota visuel
- **Vidéo** : 1 Woof/clip (~10-12s), montage multi-clips si >15s

L'user peut checker ses quotas avec **get_quota**.

---

## 🪄 TON ATTITUDE
- **Motivant** : "Trop bien ton idée !", "On va faire un truc canon !"
- **Pédagogue** : Explique simplement sans jargon
- **Proactif** : Propose des suggestions si l'user hésite
- **Concis** : Pas de blabla, droit au but

Utilise **classify_intent** en premier pour bien comprendre ce que veut l'user !`;

  const tools = [
    {
      type: "function",
      function: {
        name: "classify_intent",
        description: "Classify user request intent (image/carousel/video/autre). Use FIRST before any generation.",
        parameters: {
          type: "object",
          properties: {
            user_message: {
              type: "string",
              description: "The user's message to classify"
            }
          },
          required: ["user_message"],
          additionalProperties: false
        }
      }
    },
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
          description: "Generate an image from a text prompt (1 crédit). Supports different aspect ratios for social media. CRITICAL: Always include Brand Kit colors in your prompt.",
          parameters: {
            type: "object",
            properties: {
              prompt: { 
                type: "string", 
                description: `Ultra-detailed description of the image. MUST include:
- Composition details (angle, framing, rule of thirds)
- Brand Kit colors (${brandKit?.colors?.slice(0, 3).join(', ') || 'use brand palette'})
- Lighting (studio, natural, golden hour)
- Mood/ambiance (energetic, calm, professional)
- Quality (8K, high resolution, professional grade)
- Style (photography, illustration, 3D render)
Example: "Professional product photography, 45° angle, gradient background (${brandKit?.colors?.[0] || '#FF5733'}, ${brandKit?.colors?.[1] || '#3498DB'}), studio lighting, energetic mood, 8K"` 
              },
              aspect_ratio: { 
                type: "string", 
                description: "Aspect ratio for the image (default: 1:1). Options: 1:1 (Instagram post), 4:5 (Instagram portrait), 9:16 (Instagram story/TikTok), 16:9 (YouTube/Twitter)", 
                enum: ["1:1", "4:5", "9:16", "16:9"]
              },
              reasoning: {
                type: "string",
                description: "${expertMode ? 'REQUIRED: Explain your creative choices (composition, colors, Brand Kit alignment)' : 'Optional: Explain your creative choices'}"
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
          name: "create_carousel",
          description: "Create and generate the carousel slides after user validates the plan (costs 1 crédit per slide + quota visuel)",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Carousel theme/objective" },
              count: { type: "number", description: "Number of slides (default: 5)" },
              aspect_ratio: { 
                type: "string", 
                description: "Aspect ratio: '1:1' (Instagram), '4:5' (portrait), '9:16' (Story)", 
                enum: ["1:1", "4:5", "9:16"]
              }
            },
            required: ["prompt", "count"]
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
    ];

    // Construire le contexte pour l'orchestrateur
    const context: AgentContext = {
      brandKit: brandKit ? {
        name: brandKit.name,
        colors: brandKit.colors,
        fonts: brandKit.fonts,
        voice: brandKit.voice,
        style: brandKit.voice || 'modern professional',
        niche: brandKit.niche
      } : undefined,
      conversationHistory: transformedMessages,
      userMessage: transformedMessages[transformedMessages.length - 1]?.content || ''
    };

    // Appel avec fallback intelligent Gemini → OpenAI
    const aiResponse = await callAIWithFallback(
      [{ role: "system", content: systemPrompt }, ...transformedMessages],
      context,
      tools,
      'gemini' // Gemini prioritaire, OpenAI en fallback
    );

    // Simuler l'objet Response pour compatibilité avec le code existant
    const response = {
      ok: true,
      status: 200,
      body: null, // Pas de streaming via l'orchestrateur pour l'instant
      json: async () => aiResponse,
      text: async () => JSON.stringify(aiResponse)
    } as Response;

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Trop de requêtes, patiente un instant ! ⏳" 
          }), 
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Crédit insuffisant. Recharge tes crédits pour continuer ! 💳" 
          }), 
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Autres erreurs AI Gateway
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `Erreur AI Gateway (${response.status})` 
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return response based on stream mode
    if (stream) {
      return new Response(response.body, {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        },
      });
    } else {
      const jsonResponse = await response.json();
      return new Response(JSON.stringify(jsonResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
