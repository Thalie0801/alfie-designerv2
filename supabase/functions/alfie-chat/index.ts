// --- imports ---
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { userHasAccess } from "../_shared/access.ts";
import { callAIWithFallback } from "../_shared/aiOrchestrator.ts";

/**
 * Détecte l'intent d'un message utilisateur de manière simple (fallback si l'IA ne call pas classify_intent)
 */
function detectIntent(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('carrousel') || lowerMessage.includes('carousel') || lowerMessage.includes('slides')) {
    return 'carousel';
  }
  if (lowerMessage.includes('vidéo') || lowerMessage.includes('video')) {
    return 'video';
  }
  if (lowerMessage.includes('image') || lowerMessage.includes('visuel') || lowerMessage.includes('photo')) {
    return 'image';
  }
  if (lowerMessage.includes('crédit') || lowerMessage.includes('quota') || lowerMessage.includes('woofs')) {
    return 'credits';
  }
  if (lowerMessage.includes('brand kit') || lowerMessage.includes('marque')) {
    return 'brandkit';
  }
  
  return 'autre';
}

/**
 * Détecte si un message est une approbation (oui, ok, d'accord, etc.)
 */
function isApproval(message: string): boolean {
  const lower = message.trim().toLowerCase();
  const approvalPhrases = [
    'oui', 'ok', 'd\'accord', 'go', 'je valide', 'lance', 'vas-y', 
    'parfait', 'c\'est bon', 'yes', 'yep', 'ouais', 'exact', 'carrément',
    'absolument', 'très bien', 'impec', 'nickel', 'top'
  ];
  return approvalPhrases.some(phrase => lower === phrase || lower.startsWith(phrase + ' '));
}

import { type AgentContext, type AIResponse } from "../_shared/aiOrchestrator.ts";

// --- AI config (ASCII only) ---
const AI_CONFIG = {
  model: Deno.env.get("ALFIE_AI_MODEL") ?? "google/gemini-2.5-flash",
  endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth header ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Supabase service client ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Validate user token ---
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const functionHeaders = { Authorization: authHeader };

    // --- Access gate (Stripe or admin) ---
    const hasAccess = await userHasAccess(authHeader);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse body (ASCII keys) ---
    const { messages, brandId, stream = false, expertMode = false } =
      await req.json();
    
    // ✅ [TRACE] Log précoce de parsing
    console.log('[TRACE] Parsed request body:', {
      messagesCount: messages?.length || 0,
      brandId: brandId || 'none',
      expertMode
    });
    
    // ✅ Contrôle de garde : messages obligatoire
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('[TRACE] ❌ Missing or empty messages array');
      return new Response(JSON.stringify({ error: 'Messages array is required and must not be empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
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
        
        // ✅ [TRACE] Log du Brand Kit chargé
        console.log('[TRACE] BrandKit loaded:', {
          name: brand.name,
          colorsCount: brand.palette?.length || 0,
          fontsCount: brand.fonts?.length || 0,
          voice: brand.voice
        });
        
        // Construire le contexte Brand Kit enrichi
        const colorList = brand.palette?.map((c: any) => 
          typeof c === 'string' ? c : c.hex || c.value
        ).filter(Boolean).join(', ') || 'non défini';
        
        const fontsText = Array.isArray(brand.fonts)
          ? brand.fonts.map((f: any) => typeof f === 'string' ? f : f?.family || f?.name || String(f)).join(', ')
          : (typeof brand.fonts === 'object' && brand.fonts !== null)
            ? [brand.fonts?.primary, brand.fonts?.secondary, brand.fonts?.tertiary, brand.fonts?.headline, brand.fonts?.body].filter(Boolean).join(', ')
            : (typeof brand.fonts === 'string' ? brand.fonts : '');
        
        brandContext = `
📋 **BRAND KIT ACTIF - À RESPECTER DANS TOUTES LES CRÉATIONS:**

**Identité de marque:**
- Nom: ${brand.name}
- Secteur/Niche: ${brand.niche || 'Non spécifié'}

**Palette couleurs (À UTILISER SYSTÉMATIQUEMENT):**
${colorList}

**Typographie:**
${fontsText || 'Non définie'}


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

🚨 **RÈGLE ABSOLUE - UTILISATION OBLIGATOIRE DES TOOLS:**
Tu DOIS TOUJOURS utiliser les tools disponibles pour TOUTE demande de génération.
JAMAIS de réponse texte seule sans tool call pour les demandes de création visuelle.

⚠️ IMPORTANT: Si l'utilisateur demande une image, vidéo ou carrousel, tu DOIS appeler le tool correspondant, même si tu n'es pas sûr de tous les détails.

🔴 **RÈGLE CRITIQUE POUR LA VALIDATION:**
Quand tu as proposé un plan de carrousel et que l'utilisateur répond "oui", "ok", "parfait", "go", "lance", etc., tu DOIS IMMÉDIATEMENT appeler le tool create_carousel.
NE RÉPONDS PAS JUSTE "Je lance" en texte ! APPELLE LE TOOL create_carousel !

**Actions obligatoires par type de demande:**
- Si l'user demande une image → Tool "classify_intent" PUIS "generate_image"
- Si l'user demande un carrousel → Tool "classify_intent" PUIS "plan_carousel" (attendre validation "oui") PUIS "create_carousel"
- Si l'user demande une vidéo → Tool "classify_intent" PUIS "generate_video"
- Si l'user demande ses crédits/quota → Tool "show_usage"
- Si l'user demande son Brand Kit → Tool "show_brandkit"

⛔ **INTERDIT:** Répondre en texte libre sans appeler de tool pour les demandes de génération !

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

**⚠️ RÈGLE CRITIQUE POUR LES CARROUSELS:**

**Étape 1** : Demander les infos (réseau, objectif, nombre de slides)
**Étape 2** : Appeler le tool **plan_carousel** pour générer le plan structuré
**Étape 3** : Présenter le plan à l'utilisateur et demander validation ("Ça te va ? Si oui, je lance !")
**Étape 4** : **SI L'UTILISATEUR VALIDE (dit "oui", "ok", "parfait", etc.), TU DOIS IMMÉDIATEMENT APPELER LE TOOL create_carousel**

**EXEMPLE DE WORKFLOW COMPLET:**

User: "Fais-moi un carrousel"
Alfie: "Un carrousel ! Pour quel réseau ?" (demande infos)

User: "Instagram, 5 slides"
Alfie: [Appelle tool plan_carousel] puis présente le plan: "Voilà mon plan... Ça te va ?"

User: "oui" / "ok" / "parfait"
Alfie: **[DOIT APPELER TOOL create_carousel IMMÉDIATEMENT]** avec les paramètres: prompt, count, aspect_ratio

⚠️ **SI L'USER DIT "OUI" APRÈS UN PLAN DE CARROUSEL, TU DOIS TOUJOURS APPELER create_carousel, PAS JUSTE RÉPONDRE EN TEXTE !**

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

  console.log('[TRACE] Building tools array...');
  
  let tools: any[];
  try {
    tools = [
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
    
    console.log('[TRACE] ✅ Tools array built successfully:', tools.length, 'tools');
  } catch (error) {
    console.error('[TRACE] ❌ Error building tools array:', error);
    throw error;
  }

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

    console.log('[TRACE] Context built:', {
      hasBrandKit: !!context.brandKit,
      brandName: context.brandKit?.name,
      toolsCount: tools.length
    });

    // ======
    // BOUCLE D'EXÉCUTION DE TOOLS (max 4 itérations)
    // ======
    
    let conversationMessages = [{ role: "system", content: systemPrompt }, ...transformedMessages];
    let aiResponse: AIResponse;
    let iterationCount = 0;
    const maxIterations = 4;
    const collectedAssets: any[] = [];
    let finalJobSetId: string | undefined;
    let fallbackAttempted = false; // ✅ Flag pour éviter double fallback client/backend

    console.log('[TRACE] About to enter tool execution loop');
    console.log('[TRACE] Initial conversation:', {
      systemPromptLength: conversationMessages[0]?.content?.length,
      userMessagesCount: conversationMessages.length - 1
    });
    console.log('[TRACE] Starting tool execution loop...');

    while (iterationCount < maxIterations) {
      iterationCount++;
      console.log(`[Tool Loop] Iteration ${iterationCount}/${maxIterations}`);

      // DEBUG: Log des messages envoyés à l'IA
      console.log('[DEBUG] Messages sent to AI:', JSON.stringify(conversationMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.substring(0, 200) + '...' : m.content,
        tool_calls: m.tool_calls?.length || 0
      })), null, 2));
      console.log('[DEBUG] Tools available:', tools.map(t => t.function.name).join(', '));

      // ✅ Appel avec fallback intelligent Gemini → OpenAI (Gemini en priorité)
      aiResponse = await callAIWithFallback(
        conversationMessages,
        context,
        tools,
        'gemini', // ✅ Gemini en priorité
        iterationCount - 1 // iterationCount commence à 1, mais on veut 0 pour la première itération
      );

      // DEBUG: Log de la réponse de l'IA
      console.log('[DEBUG] AI Response:', JSON.stringify({
        content: aiResponse.choices[0]?.message?.content?.substring(0, 200) + '...',
        tool_calls_count: aiResponse.choices[0]?.message?.tool_calls?.length || 0,
        tool_calls: aiResponse.choices[0]?.message?.tool_calls?.map(tc => tc.function?.name)
      }, null, 2));

      const assistantMessage = aiResponse.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No assistant message in AI response');
      }

      // Vérifier s'il y a des tool_calls
      const toolCalls = assistantMessage.tool_calls;
      
      if (!toolCalls || toolCalls.length === 0) {
        // ✅ FALLBACK DUR: Si c'est la première itération et qu'aucun tool n'est appelé
        if (iterationCount === 1) {
          console.warn('[FALLBACK] AI did not call any tool on first iteration, forcing manual intervention');
          
          // Détecter l'intent manuellement
          const lastUserMessage = conversationMessages.filter(m => m.role === 'user').pop()?.content || '';
          
          // ✅ CHECK: Est-ce une approbation ?
          if (isApproval(lastUserMessage)) {
            console.log('[FALLBACK][Approval] Detected approval:', lastUserMessage);
            
            // Chercher le dernier message utilisateur avec un intent
            let intentMessage = '';
            let detectedIntent = '';
            
            for (let i = conversationMessages.length - 2; i >= 0; i--) {
              const msg = conversationMessages[i];
              if (msg.role === 'user') {
                const content = msg.content || '';
                const match = content.match(/(carrousel|carousel|image|vidéo|video)/i);
                if (match) {
                  intentMessage = content;
                  detectedIntent = match[1].toLowerCase();
                  break;
                }
              }
            }
            
            console.log('[FALLBACK][Approval] Previous intent:', detectedIntent, 'Message:', intentMessage.substring(0, 50));
            
            // Si carrousel trouvé, générer plan + images immédiatement
            if ((detectedIntent === 'carrousel' || detectedIntent === 'carousel') && intentMessage) {
              console.log('[FALLBACK][Approval] Generating carousel plan and images...');
              fallbackAttempted = true; // ✅ Marquer qu'on a tenté le fallback
              
              try {
                // 1. Générer le plan
                const { data: planData, error: planError } = await supabase.functions.invoke('alfie-plan-carousel', {
                  body: {
                    prompt: intentMessage,
                    slideCount: 5,
                    brandKit: brandKit
                  },
                  headers: functionHeaders
                });
                
                if (planError || !planData?.plan?.slides) {
                  throw new Error(planError?.message || 'Plan generation failed');
                }
                
                console.log('[FALLBACK][Approval] Plan fetched:', planData.plan.slides.length, 'slides');
                
                // 2. Générer les images pour chaque slide AVEC NOUVELLE APPROCHE 2 ÉTAPES
                const slides = planData.plan.slides;
                const collectedAssets: any[] = [];
                
                for (let i = 0; i < slides.length; i++) {
                  const slide = slides[i];
                  const overlayText = `${slide.title}\n${slide.subtitle || slide.punchline || ''}`;
                  
                  console.log(`[FALLBACK][Approval] Generating slide ${i + 1}/${slides.length}...`);
                  
                  // ÉTAPE 1: Fond sans texte
                  const { data: bgData, error: bgError } = await supabase.functions.invoke('alfie-render-image', {
                    body: {
                      provider: 'gemini_image',
                      prompt: slide.note || `Image pour ${slide.title}`,
                      format: '1024x1280',
                      brand_id: brandId,
                      cost_woofs: 1,
                      backgroundOnly: true, // ← PAS DE TEXTE
                      slideIndex: i,
                      totalSlides: slides.length,
                      negativePrompt: 'logos de marques tierces, filigranes, artefacts, texte, typography, letters'
                    },
                    headers: functionHeaders
                  });
                  
                  const bgUrl = bgData?.data?.image_urls?.[0];
                  if (bgError || !bgUrl) {
                    console.error(`[FALLBACK][Approval] Background failed for slide ${i + 1}:`, bgError);
                    continue;
                  }
                  
                  // ÉTAPE 2: Overlay texte
                  const { data: textData, error: textError } = await supabase.functions.invoke('alfie-add-text-overlay', {
                    body: {
                      imageUrl: bgUrl,
                      overlayText: overlayText,
                      brand_id: brandId,
                      slideIndex: i,
                      totalSlides: slides.length
                    },
                    headers: functionHeaders
                  });
                  
                  const finalUrl = textData?.data?.image_url;
                  if (textError || !finalUrl) {
                    console.error(`[FALLBACK][Approval] Text overlay failed for slide ${i + 1}:`, textError);
                    // Utiliser le fond si le texte échoue
                    collectedAssets.push({
                      type: 'image',
                      url: bgUrl,
                      title: `Slide ${i + 1}/${slides.length} (background only)`,
                      reasoning: slide.note || '',
                      brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                    });
                  } else {
                    collectedAssets.push({
                      type: 'image',
                      url: finalUrl,
                      title: `Slide ${i + 1}/${slides.length}`,
                      reasoning: slide.note || '',
                      brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                    });
                    console.log(`[FALLBACK][Approval] Slide ${i + 1}/${slides.length} completed:`, finalUrl.substring(0, 80) + '...');
                  }
                }
                
                // Retourner la réponse avec tous les assets
                return new Response(
                  JSON.stringify({
                    choices: [{
                      message: {
                        role: 'assistant',
                        content: `✅ Carrousel généré ! Voici tes ${slides.length} slides.`
                      }
                    }],
                    assets: collectedAssets,
                    noToolCalls: false
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              } catch (approvalError: any) {
                console.error('[FALLBACK][Approval] Error:', approvalError);
                // Continuer avec le flux normal
              }
            }
            
            // Pour les intents image/vidéo, forcer la classification
            if (detectedIntent === 'image') {
              console.log('[FALLBACK][Approval] Forcing image classification...');
              conversationMessages.push({
                role: 'assistant',
                content: 'Je vais générer cette image pour toi !',
                tool_calls: [{
                  id: 'fallback-classify',
                  type: 'function',
                  function: { name: 'classify_intent', arguments: JSON.stringify({ intent: 'image' }) }
                }]
              });
              conversationMessages.push({
                role: 'tool',
                tool_call_id: 'fallback-classify',
                content: JSON.stringify({ intent: 'image' })
              });
              continue;
            } else if (detectedIntent === 'vidéo' || detectedIntent === 'video') {
              console.log('[FALLBACK][Approval] Forcing video classification...');
              conversationMessages.push({
                role: 'assistant',
                content: 'Je vais générer cette vidéo pour toi !',
                tool_calls: [{
                  id: 'fallback-classify',
                  type: 'function',
                  function: { name: 'classify_intent', arguments: JSON.stringify({ intent: 'video' }) }
                }]
              });
              conversationMessages.push({
                role: 'tool',
                tool_call_id: 'fallback-classify',
                content: JSON.stringify({ intent: 'video' })
              });
              continue;
            }
          }
          
          // ✅ Fallback normal pour les messages non-approbation
          const detectedIntent = detectIntent(lastUserMessage);
          console.log(`[FALLBACK] Detected intent: ${detectedIntent}`);
          
          // ✅ Si carrousel → générer plan ET images immédiatement
          if (detectedIntent === 'carousel') {
            console.log('[FALLBACK] Generating carousel plan and images...');
            fallbackAttempted = true; // ✅ Marquer qu'on a tenté le fallback
            
            try {
              // 1. Générer le plan
              const { data: planData, error: planError } = await supabase.functions.invoke('alfie-plan-carousel', {
                body: {
                  prompt: lastUserMessage,
                  slideCount: 5,
                  brandKit: brandKit
                },
                headers: functionHeaders
              });
              
              if (planError || !planData?.plan?.slides) {
                throw new Error(planError?.message || 'Plan generation failed');
              }
              
              console.log('[FALLBACK] Plan fetched:', planData.plan.slides.length, 'slides');
              
              // 2. Générer les images pour chaque slide avec NOUVELLE APPROCHE 2 ÉTAPES
              const slides = planData.plan.slides;
              
              for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];
                const overlayText = `${slide.title}\n${slide.subtitle || slide.punchline || ''}`;
                
                console.log(`[FALLBACK] Generating slide ${i + 1}/${slides.length}...`);
                
                // ÉTAPE 1: Générer le fond sans texte
                const { data: bgData, error: bgError } = await supabase.functions.invoke('alfie-render-image', {
                  body: {
                    provider: 'gemini_image',
                    prompt: slide.note || `Image pour ${slide.title}`,
                    format: '1024x1280',
                    brand_id: brandId,
                    cost_woofs: 1,
                    backgroundOnly: true, // ← PAS DE TEXTE
                    slideIndex: i,
                    totalSlides: slides.length,
                    negativePrompt: 'logos de marques tierces, filigranes, artefacts, texte, typography, letters'
                  },
                  headers: functionHeaders
                });
                
                const bgUrl = bgData?.data?.image_urls?.[0];
                if (bgError || !bgUrl) {
                  console.error(`[FALLBACK] Background failed for slide ${i + 1}:`, bgError);
                  continue;
                }
                console.log(`[FALLBACK] Background for slide ${i + 1}:`, bgUrl.substring(0, 80) + '...');
                
                // ÉTAPE 2: Ajouter le texte en overlay
                const { data: textData, error: textError } = await supabase.functions.invoke('alfie-add-text-overlay', {
                  body: {
                    imageUrl: bgUrl,
                    overlayText: overlayText,
                    brand_id: brandId,
                    slideIndex: i,
                    totalSlides: slides.length,
                    textPosition: 'center',
                    fontSize: 48
                  },
                  headers: functionHeaders
                });
                
                const finalUrl = textData?.data?.image_url;
                if (textError || !finalUrl) {
                  console.error(`[FALLBACK] Text overlay failed for slide ${i + 1}:`, textError);
                  // Si le texte échoue, utiliser quand même le fond
                  collectedAssets.push({
                    type: 'image',
                    url: bgUrl,
                    title: `Slide ${i + 1}/${slides.length} (background only)`,
                    reasoning: slide.note || '',
                    brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                  });
                  console.log(`[FALLBACK] Using background only for slide ${i + 1}`);
                } else {
                  collectedAssets.push({
                    type: 'image',
                    url: finalUrl,
                    title: `Slide ${i + 1}/${slides.length}`,
                    reasoning: slide.note || '',
                    brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                  });
                  console.log(`[FALLBACK] Slide ${i + 1}/${slides.length} completed with text:`, finalUrl.substring(0, 80) + '...');
                }
              }
              
              // Retourner la réponse avec tous les assets
              return new Response(
                JSON.stringify({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: `✅ Carrousel généré ! Voici tes ${slides.length} slides.`
                    }
                  }],
                  assets: collectedAssets,
                  noToolCalls: false
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } catch (error) {
              console.error('[FALLBACK] Error generating carousel:', error);
              // Continuer avec le flux normal en cas d'erreur
            }
          }
          
          // ✅ Si image/vidéo → pousser un message assistant minimal et reboucler
          if (detectedIntent === 'image' || detectedIntent === 'video') {
            console.log(`[FALLBACK] Priming ${detectedIntent} generation...`);
            
            conversationMessages.push({
              role: 'assistant',
              content: detectedIntent === 'image' 
                ? 'Je vais générer une image pour toi. Quel format ? (1:1, 9:16, 16:9, 4:5)' 
                : 'Je vais générer une vidéo. Quelle durée et quel format ? (9:16 Reel, 1:1, 16:9)'
            });
            
            // Reboucler
            continue;
          }
        }
        
        // Pas de tools à exécuter, on sort de la boucle
        console.log('[Tool Loop] No more tool calls, finishing');
        console.warn('[Tool Loop] ⚠️ AI returned text-only response without tool calls. Surfacing noToolCalls flag.');
        break;
      }

      console.log(`[Tool Loop] ✅ Executing ${toolCalls.length} tool(s):`, toolCalls.map(tc => tc.function?.name).join(', '));

      // Ajouter le message assistant avec tool_calls à l'historique
      conversationMessages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: toolCalls
      });

      // Exécuter chaque tool call
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name;
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        
        console.log(`[Tool Execution] ${toolName}`, toolArgs);

        let toolResult: any = { error: 'Tool not implemented' };

        try {
          switch (toolName) {
            case 'classify_intent': {
              const { data: intentData } = await supabase.functions.invoke('alfie-classify-intent', {
                body: { user_message: toolArgs.user_message },
                headers: functionHeaders
              });
              toolResult = intentData || { intent: 'autre' };
              break;
            }

            case 'plan_carousel': {
              const { data: planData, error: planError } = await supabase.functions.invoke('alfie-plan-carousel', {
                body: {
                  prompt: toolArgs.prompt,
                  slideCount: toolArgs.count || 5,
                  brandKit: brandKit || {}
                },
                headers: functionHeaders
              });
              if (planError) throw planError;
              toolResult = planData?.plan || planData || { slides: [] };
              break;
            }

            case 'create_carousel': {
              const { data: planResp } = await supabase.functions.invoke('alfie-plan-carousel', {
                body: {
                  messages,
                  brandId,
                  aspect_ratio: '4:5',
                  slideCount: toolArgs.count || 5,
                  brandKit: brandKit ?? {},
                  prompt: toolArgs.prompt,
                },
                headers: { Authorization: authHeader },
              });

              const carouselPlan = toolArgs.plan
                ?? planResp?.plan
                ?? planResp
                ?? { slides: [] };

              const slides: any[] = Array.isArray(carouselPlan?.slides)
                ? carouselPlan.slides
                : [];

              const generatedImages: string[] = [];

              for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];

                const overlayText = `${slide.title ?? ''}\n${slide.subtitle ?? slide.text ?? ''}`.trim();

                const aspectRatio = carouselPlan?.globals?.aspect_ratio ?? '4:5';
                const format =
                  aspectRatio === '9:16'
                    ? '1024x1820'
                    : aspectRatio === '16:9'
                    ? '1820x1024'
                    : aspectRatio === '4:5'
                    ? '1024x1280'
                    : '1024x1024';

                // NOUVELLE APPROCHE 2 ÉTAPES: Fond sans texte + Overlay texte
                // ÉTAPE 1: Générer le fond visuel (sans texte)
                const { data: bgData, error: bgError } = await supabase.functions.invoke('alfie-render-image', {
                  body: {
                    provider: 'gemini_image',
                    prompt: slide.note ?? slide.imagePrompt ?? `Image pour: ${slide.title ?? 'Slide'}`,
                    format,
                    brand_id: brandId,
                    backgroundOnly: true, // ← PAS DE TEXTE généré par l'IA
                    slideIndex: i,
                    totalSlides: slides.length,
                    backgroundStyle: slide.backgroundStyle || 'gradient',
                    textContrast: slide.textContrast || 'dark',
                    negativePrompt: 'logos de marques tierces, filigranes, artefacts, texte, typography, letters',
                  },
                  headers: { Authorization: authHeader },
                });

                const bgUrl = bgData?.data?.image_urls?.[0];
                if (bgError || !bgUrl) {
                  console.error(`[Tool Execution] Background generation failed for slide ${i + 1}:`, bgError);
                  continue;
                }
                console.log(`[Tool Execution] Background generated for slide ${i + 1}:`, bgUrl.substring(0, 80) + '...');

                // ÉTAPE 2: Ajouter le texte en overlay (orthographe parfaite)
                const { data: finalData, error: textError } = await supabase.functions.invoke('alfie-add-text-overlay', {
                  body: {
                    imageUrl: bgUrl,
                    overlayText,
                    brand_id: brandId,
                    slideIndex: i,
                    totalSlides: slides.length,
                    slideNumber: slide.slideNumber || `${i + 1}/${slides.length}`,
                    textContrast: slide.textContrast || 'dark',
                    isLastSlide: i === slides.length - 1,
                    textPosition: 'center',
                    fontSize: 48
                  },
                  headers: { Authorization: authHeader },
                });

                const finalUrl = finalData?.data?.image_url;
                if (textError || !finalUrl) {
                  console.error(`[Tool Execution] Text overlay failed for slide ${i + 1}:`, textError);
                  // En cas d'échec du texte, on utilise quand même le fond
                  generatedImages.push(bgUrl); // ← FIX: Ajouter l'URL au tableau
                  collectedAssets.push({
                    type: 'image',
                    url: bgUrl,
                    title: `Slide ${i + 1}/${slides.length} (background only)`,
                    reasoning: slide.note || '',
                    brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                  });
                } else {
                  console.log(`[Tool Execution] Final image with text for slide ${i + 1}:`, finalUrl.substring(0, 80) + '...');
                  generatedImages.push(finalUrl); // ← FIX: Ajouter l'URL au tableau
                  collectedAssets.push({
                    type: 'image',
                    url: finalUrl,
                    title: `Slide ${i + 1}/${slides.length}`,
                    reasoning: slide.note || '',
                    brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                  });
                }
              }

              toolResult = {
                success: true,
                slideCount: generatedImages.length,
                images: generatedImages,
              };
              break;
            }

            case 'generate_image': {
              let optimizedPrompt = toolArgs.prompt;

              if (brandKit) {
                const { data: opt } = await supabase.functions.invoke('alfie-optimize-prompt', {
                  body: {
                    prompt: toolArgs.prompt,
                    brandKit: {
                      palette: brandKit.colors ?? [],
                      voice: brandKit.voice,
                      niche: brandKit.niche,
                    },
                  },
                  headers: { Authorization: authHeader },
                });
                optimizedPrompt = opt?.optimizedPrompt ?? toolArgs.prompt;
              }

              const aspectRatio = toolArgs.aspect_ratio ?? '1:1';
              const format =
                aspectRatio === '9:16'
                  ? '1024x1820'
                  : aspectRatio === '16:9'
                  ? '1820x1024'
                  : aspectRatio === '4:5'
                  ? '1024x1280'
                  : '1024x1024';

            const { data: imageData, error: imageError } = await supabase.functions.invoke('alfie-render-image', {
              body: {
                provider: 'gemini_image',
                prompt: optimizedPrompt,
                format,
                brand_id: brandId,
              },
              headers: { Authorization: authHeader },
            });

            if (imageError) throw imageError;

            const url = imageData?.data?.image_urls?.[0];
            if (!url) {
              console.warn('[Tool Execution] Missing image URL, response keys:', Object.keys(imageData || {}));
              throw new Error('Image generation returned no URL');
            }
            
            console.log('[Tool Execution] Image generated URL:', url);

            collectedAssets.push({
              type: 'image',
              url,
              rationale: toolArgs.rationale ?? toolArgs.reasoning,
              brandAlignment: 'Brand kit applied',
            });

            toolResult = {
              success: true,
              imageUrl: url,
              generationId: imageData?.generation_id,
            };
              break;
            }

            case 'generate_video': {
              const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
                body: {
                  prompt: toolArgs.prompt,
                  aspect_ratio: toolArgs.aspect_ratio ?? '16:9',
                  brand_id: brandId,
                  imageUrl: toolArgs.imageUrl ?? null,
                },
                headers: { Authorization: authHeader },
              });

              if (videoError) throw videoError;

              toolResult = {
                success: true,
                jobId: videoData?.jobId,
                status: 'processing',
              };
              break;
            }

            case 'check_credits':
            case 'show_usage': {
              const { data: quota } = await supabase.functions.invoke('get-quota', {
                body: { brand_id: brandId },
                headers: { Authorization: authHeader },
              });

              toolResult = {
                woofs_remaining: quota?.woofs_remaining ?? 0,
                woofs_quota: quota?.woofs_quota ?? 0,
                visuals_remaining: quota?.visuals_remaining ?? 0,
                visuals_quota: quota?.visuals_quota ?? 0,
                plan: quota?.plan ?? 'free',
              };
              break;
            }

            case 'show_brandkit': {
              toolResult = {
                name: brandKit?.name ?? null,
                colors: brandKit?.colors ?? [],
                fonts: brandKit?.fonts ?? [],
                voice: brandKit?.voice ?? null,
                niche: brandKit?.niche ?? null,
              };
              break;
            }

            default:
              console.warn(`[Tool Execution] Unknown tool: ${toolName}`);
              toolResult = { error: `Tool ${toolName} not implemented` };
          }
        } catch (error: any) {
          console.error(`[Tool Execution] Error in ${toolName}:`, error);
          toolResult = { error: error.message || 'Tool execution failed' };
        }

        // Ajouter le résultat du tool à l'historique
        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });
      }
    }

    // Construire la réponse finale
    const finalMessage = aiResponse!.choices[0]?.message;
    const responsePayload: any = {
      ok: true,
      choices: [{
        message: {
          role: 'assistant',
          content: finalMessage?.content || ''
        }
      }]
    };

    // ✅ Surfacer si aucun tool n'a été appelé ET qu'aucun fallback n'a été tenté
    if (collectedAssets.length === 0 && !finalJobSetId && !fallbackAttempted) {
      responsePayload.noToolCalls = true;
      console.warn('[Response] Surfacing noToolCalls=true (no generation triggered)');
    }

    // Ajouter les assets collectés s'il y en a
    if (collectedAssets.length > 0) {
      responsePayload.assets = collectedAssets;
    }

    if (finalJobSetId) {
      responsePayload.jobSetId = finalJobSetId;
    }

    // Return response
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ERROR] alfie-chat crashed:", error);
    console.error("[ERROR] Stack trace:", error instanceof Error ? error.stack : 'No stack');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
