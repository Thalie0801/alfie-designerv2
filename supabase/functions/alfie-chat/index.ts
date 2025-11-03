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

    const systemPrompt = `Tu es **Alfie** 🐾, assistant IA pour la création de contenu visuel.

🚨 **RÈGLE ABSOLUE : TOUJOURS UTILISER LES TOOLS**

Pour TOUTE demande de création, tu DOIS appeler un tool :
- **Carrousel** → classify_intent PUIS plan_carousel PUIS (après validation) create_carousel
- **Image** → classify_intent PUIS generate_image
- **Vidéo** → classify_intent PUIS generate_video
- **Crédits** → show_usage
- **Brand Kit** → show_brandkit

⛔ **INTERDIT :** Répondre en texte seul pour les demandes de création.

${brandContext}

## 🎯 TON STYLE
Chaleureux et motivant 🎨 ✨ 🐾
Emojis naturels, tutoiement friendly, phrases courtes.
Encouragements : "Trop bien ton idée !", "On va faire un truc canon !"

## ⚡ WORKFLOW RAPIDE

**Carrousel :**
1. Demande infos (réseau, slides, objectif)
2. Call tool **plan_carousel**
3. Présente le plan, demande validation
4. Si "oui" → Call tool **create_carousel** IMMÉDIATEMENT

**Image/Vidéo :**
1. Demande ratio, objectif
2. Call tool **generate_image** ou **generate_video**

**IMPORTANT :** Si l'user dit "oui" après un plan, tu DOIS call create_carousel, PAS répondre en texte !

## 🎨 PROMPTS DÉTAILLÉS

**Images :** Ultra-descriptif avec couleurs Brand Kit (${brandKit?.colors?.slice(0, 3).join(', ') || 'palette pro'}), composition, lighting, mood, qualité 8K
**Vidéos :** Mouvement caméra, actions temporelles, couleurs Brand Kit, style cinématique

${expertMode ? `
## 🧠 MODE EXPERT
Explique ton raisonnement : pourquoi ce style, comment tu respectes le Brand Kit, quelle stratégie visuelle.
` : ''}

Utilise **classify_intent** en premier pour comprendre la demande !`;

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
    const maxIterations = 5; // ✅ Augmenté à 5 pour permettre injections synthétiques
    const collectedAssets: any[] = [];
    let finalJobSetId: string | undefined;
    let fallbackAttempted = false; // ✅ Flag pour éviter double fallback client/backend
    let syntheticInjectionDone = false; // ✅ Flag pour éviter double injection

    console.log('[TRACE] About to enter tool execution loop');
    console.log('[TRACE] Initial conversation:', {
      systemPromptLength: conversationMessages[0]?.content?.length,
      userMessagesCount: conversationMessages.length - 1
    });
    console.log('[TRACE] Starting tool execution loop...');

    while (iterationCount < maxIterations) {
      iterationCount++;
      console.log(`[Tool Loop] === Iteration ${iterationCount}/${maxIterations} ===`);
      console.log(`[Tool Loop] Conversation history: ${conversationMessages.length} messages`);
      console.log(`[Tool Loop] syntheticInjectionDone: ${syntheticInjectionDone}`);
      
      // ✅ PRÉ-CHECK DE QUOTA (avant d'appeler l'IA) pour éviter 402
      if (iterationCount === 1) {
        const lastUserMessage = conversationMessages.filter(m => m.role === 'user').pop()?.content || '';
        const detectedIntent = detectIntent(lastUserMessage);
        console.log(`[Pre-check] Detected intent: ${detectedIntent}`);
        
        if ((detectedIntent === 'carousel' || detectedIntent === 'image' || detectedIntent === 'video') && brandId) {
          console.log('[Pre-check] Detected generation intent:', detectedIntent, '- checking quotas');
          
          try {
            const { data: quota, error: quotaError } = await supabase.functions.invoke('get-quota', {
              body: { brand_id: brandId },
              headers: functionHeaders
            });
            
            if (quotaError || !quota?.ok) {
              console.error('[Pre-check] Quota check failed:', quotaError, quota);
            } else {
              const woofsRemaining = quota.data?.woofs_remaining || 0;
              
              // Si pas de woofs (crédits IA), renvoyer 402 immédiatement
              if (woofsRemaining === 0) {
                console.warn('[Pre-check] ⚠️ No Woofs remaining, returning 402 immediately');
                return new Response(
                  JSON.stringify({ 
                    error: 'Payment required, please add funds to your Lovable AI workspace.',
                    code: 'PAYMENT_REQUIRED'
                  }),
                  {
                    status: 402,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  }
                );
              }
              
              console.log('[Pre-check] ✅ Quota OK:', woofsRemaining, 'Woofs remaining');
            }
          } catch (preCheckError: any) {
            console.error('[Pre-check] Error:', preCheckError);
            // Ne pas bloquer, continuer
          }
        }
      }

      // DEBUG: Log des messages envoyés à l'IA
      console.log('[DEBUG] Messages sent to AI:', JSON.stringify(conversationMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.substring(0, 200) + '...' : m.content,
        tool_calls: m.tool_calls?.length || 0
      })), null, 2));
      console.log('[DEBUG] Tools available:', tools.map(t => t.function.name).join(', '));

      // ✅ Appel avec fallback intelligent OpenAI → Gemini (OpenAI est plus fiable pour les tool_calls)
      aiResponse = await callAIWithFallback(
        conversationMessages,
        context,
        tools,
        'openai', // ✅ OpenAI en priorité pour les tool_calls
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
        console.warn('[Tool Loop] ⚠️ No tool calls from AI on iteration', iterationCount);
        
        // ✅ INJECTION SYNTHÉTIQUE ITÉRATION 2: Injecter classify_intent
        if (iterationCount === 2 && !syntheticInjectionDone) {
          console.log('[Synthetic Injection] Iteration 2: Injecting classify_intent...');
          syntheticInjectionDone = true;
          
          const lastUserMsg = conversationMessages.filter(m => m.role === 'user').pop()?.content || '';
          
          // Appeler classify_intent
          const { data: classifyData, error: classifyError } = await supabase.functions.invoke('alfie-classify-intent', {
            body: { user_message: lastUserMsg },
            headers: functionHeaders
          });
          
          const intent = classifyData?.intent || detectIntent(lastUserMsg);
          console.log('[Synthetic Injection] Intent detected:', intent);
          
          // Injecter assistant avec tool_call
          conversationMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'synthetic-classify',
              type: 'function',
              function: { name: 'classify_intent', arguments: JSON.stringify({ user_message: lastUserMsg }) }
            }]
          });
          
          // Injecter tool result
          conversationMessages.push({
            role: 'tool',
            tool_call_id: 'synthetic-classify',
            name: 'classify_intent',
            content: JSON.stringify({ intent })
          });
          
          continue; // Relancer avec ce nouvel historique
        }
        
        // ✅ INJECTION SYNTHÉTIQUE ITÉRATION 3: Si intent = carousel, injecter plan_carousel
        if (iterationCount === 3 && syntheticInjectionDone) {
          const lastUserMsg = conversationMessages.filter(m => m.role === 'user').pop()?.content || '';
          const intent = detectIntent(lastUserMsg);
          
          if (intent === 'carousel') {
            console.log('[Synthetic Injection] Iteration 3: Injecting plan_carousel...');
            
            try {
              // Appeler alfie-plan-carousel
              const { data: planData, error: planError } = await supabase.functions.invoke('alfie-plan-carousel', {
                body: {
                  prompt: lastUserMsg,
                  slideCount: 5,
                  brandKit: brandKit
                },
                headers: functionHeaders
              });
              
              if (planError) throw planError;
              
              console.log('[Synthetic Injection] Plan received:', planData?.plan?.slides?.length, 'slides');
              
              // Injecter assistant avec tool_call
              conversationMessages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: 'synthetic-plan',
                  type: 'function',
                  function: { 
                    name: 'plan_carousel', 
                    arguments: JSON.stringify({ 
                      prompt: lastUserMsg, 
                      count: 5, 
                      aspect_ratio: '4:5' 
                    }) 
                  }
                }]
              });
              
              // Injecter tool result
              conversationMessages.push({
                role: 'tool',
                tool_call_id: 'synthetic-plan',
                name: 'plan_carousel',
                content: JSON.stringify(planData)
              });
              
              continue; // Relancer pour que l'IA réponde avec le plan
            } catch (planError: any) {
              console.error('[Synthetic Injection] Plan carousel failed:', planError);
              // Continuer avec le fallback manuel ci-dessous
            }
          }
        }
        
        // ✅ NE PAS activer fallback à la 1ère itération - forcer retry
        if (iterationCount === 1) {
          console.log('[Tool Loop] No tools called on iteration 1, AI will retry with explicit prompt');
          
          // Ajouter message système pour forcer tool calling
          conversationMessages.push({
            role: 'system',
            content: '⚠️ Tu DOIS appeler un tool (classify_intent, plan_carousel, create_carousel, generate_image, etc.) pour répondre à cette demande. NE RÉPONDS PAS en texte seul.'
          });
          
          continue; // Relancer iteration
        }
        
        // ✅ FALLBACK DUR: Activer seulement à partir de l'itération 4+
        if (iterationCount >= 4) {
          console.warn('[FALLBACK] AI still did not call tools after retry, activating manual fallback');
          
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
                    backgroundStyle: slide.backgroundStyle || 'gradient',
                    textContrast: slide.textContrast || 'dark',
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
                
                // ✅ NOUVEAU : Construire overlayText depuis le slide AVANT l'appel à alfie-add-text-overlay
                const overlayText = [
                  slide.title || '',
                  slide.subtitle || slide.punchline || ''
                ].filter(Boolean).join('\n');
                
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
              console.log('[Response] Returning carousel assets count:', collectedAssets.length);
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
            } catch (fallbackError: any) {
              console.error('[FALLBACK] Error generating carousel:', fallbackError);
              
              // Détecter si c'est un 402 (crédits insuffisants)
              const errorStatus = fallbackError?.context?.response?.status || fallbackError?.status;
              const errorMessage = fallbackError.message?.toLowerCase() || '';
              
              if (errorStatus === 402 || errorMessage.includes('402') || errorMessage.includes('payment required')) {
                console.log('[FALLBACK] 402 detected - generating text-only carousel plan');
                
                // Générer un plan textuel simple sans appeler l'IA
                const count = 5; // Valeur par défaut
                const textPlan = {
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: `📋 **Voici le plan de ton carrousel** (${count} slides)\n\n⚠️ **Crédits insuffisants** pour générer les images.\n\nRecharge tes crédits pour que je puisse créer les visuels ! 👇\n\n[Recharger mes crédits](/billing)`
                    }
                  }],
                  noCredits: true
                };
                
                return new Response(
                  JSON.stringify(textPlan),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              // Continuer avec le flux normal pour autres erreurs
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
              const count = toolArgs.count || 5;
              const { data: planResp } = await supabase.functions.invoke('alfie-plan-carousel', {
                body: {
                  messages,
                  brandId,
                  aspect_ratio: '4:5',
                  slideCount: count,
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
                let bgUrl: string | null = null;
                let finalUrl: string | null = null;

                const aspectRatio = carouselPlan?.globals?.aspect_ratio ?? '4:5';
                const format =
                  aspectRatio === '9:16'
                    ? '1024x1820'
                    : aspectRatio === '16:9'
                    ? '1820x1024'
                    : aspectRatio === '4:5'
                    ? '1024x1280'
                    : '1024x1024';

                // Proofread titre/subtitle AVANT overlay
                let correctedTitle = slide.title || '';
                let correctedSubtitle = slide.subtitle || '';
                try {
                  const { data: proofData } = await supabase.functions.invoke('alfie-proofread-fr', {
                    body: { title: slide.title, subtitle: slide.subtitle },
                    headers: { Authorization: authHeader },
                  });
                  if (proofData?.data) {
                    correctedTitle = proofData.data.title || correctedTitle;
                    correctedSubtitle = proofData.data.subtitle || correctedSubtitle;
                  }
                } catch (e) {
                  console.warn(`[Tool Execution] Proofread failed for slide ${i + 1}, using original`);
                }

                const overlayText = `${correctedTitle}\n${correctedSubtitle}`.trim();

                // ÉTAPE 1: Générer le fond avec retries
                let retryCount = 0;
                const maxRetries = 2;
                while (!bgUrl && retryCount <= maxRetries) {
                  const { data: bgData, error: bgError } = await supabase.functions.invoke('alfie-render-image', {
                    body: {
                      provider: 'gemini_image',
                      prompt: slide.note ?? `Minimalist solid background, high-contrast center safe area, NO TEXT.`,
                      format,
                      brand_id: brandId,
                      backgroundOnly: true,
                      slideIndex: i,
                      totalSlides: count,
                      backgroundStyle: slide.backgroundStyle || 'gradient',
                      textContrast: slide.textContrast || 'dark',
                      negativePrompt: 'text, typography, letters, watermarks',
                    },
                    headers: { Authorization: authHeader },
                  });

                  if (!bgError && bgData?.data?.image_urls?.[0]) {
                    bgUrl = bgData.data.image_urls[0];
                    console.log(`[Tool Execution] Background OK for slide ${i + 1} (retry ${retryCount})`);
                  } else {
                    retryCount++;
                    if (retryCount <= maxRetries) {
                      await new Promise(r => setTimeout(r, 500 + retryCount * 400));
                    }
                  }
                }

                if (!bgUrl) {
                  console.warn(`[Tool Execution] No background for slide ${i + 1}, will generate fallback`);
                  continue;
                }

                // ÉTAPE 2: Ajouter le texte en overlay avec retries
                retryCount = 0;
                while (!finalUrl && retryCount <= maxRetries) {
                  const { data: overlayData, error: overlayError } = await supabase.functions.invoke('alfie-add-text-overlay', {
                    body: {
                      imageUrl: bgUrl,
                      overlayText,
                      brand_id: brandId,
                      slideIndex: i,
                      totalSlides: count,
                      slideNumber: slide.slideNumber || `${i + 1}/${count}`,
                      textContrast: slide.textContrast || 'dark',
                      isLastSlide: i === count - 1,
                      textPosition: 'center',
                      fontSize: 48
                    },
                    headers: { Authorization: authHeader },
                  });

                  if (!overlayError && overlayData?.data?.image_url) {
                    finalUrl = overlayData.data.image_url;
                    console.log(`[Tool Execution] Overlay OK for slide ${i + 1} (retry ${retryCount})`);
                  } else {
                    retryCount++;
                    if (retryCount <= maxRetries) {
                      await new Promise(r => setTimeout(r, 500 + retryCount * 400));
                    } else {
                      console.warn(`[Tool Execution] Overlay failed after retries for slide ${i + 1}, using bg only`);
                      finalUrl = bgUrl;
                    }
                  }
                }

                generatedImages.push(finalUrl!);
                collectedAssets.push({
                  type: 'image',
                  url: finalUrl!,
                  title: `Slide ${i + 1}/${count}${finalUrl === bgUrl ? ' (bg only)' : ''}`,
                  reasoning: slide.note || '',
                  brandAlignment: brandKit ? 'Aligned with brand colors and voice' : ''
                });
              }

              // Compléter si manque des slides
              while (generatedImages.length < count) {
                const missingIndex = generatedImages.length;
                console.log(`[Tool Execution] Generating fallback slide ${missingIndex + 1}/${count}`);
                
                const { data: fallbackBg } = await supabase.functions.invoke('alfie-render-image', {
                  body: {
                    provider: 'gemini_image',
                    prompt: `Minimalist solid background, high-contrast center, NO TEXT`,
                    format: '1024x1280',
                    brand_id: brandId,
                    backgroundOnly: true,
                    slideIndex: missingIndex,
                    totalSlides: count,
                    backgroundStyle: 'solid',
                    textContrast: 'dark',
                    negativePrompt: 'text, typography, letters',
                  },
                  headers: { Authorization: authHeader },
                });

                const fallbackUrl = fallbackBg?.data?.image_urls?.[0] || '';
                if (fallbackUrl) {
                  generatedImages.push(fallbackUrl);
                  collectedAssets.push({
                    type: 'image',
                    url: fallbackUrl,
                    title: `Slide ${missingIndex + 1}/${count} (fallback)`,
                    reasoning: 'Fallback background',
                    brandAlignment: ''
                  });
                } else {
                  generatedImages.push('');
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
    if (collectedAssets.length === 0 && !finalJobSetId && !fallbackAttempted && !syntheticInjectionDone) {
      responsePayload.noToolCalls = true;
      console.warn('[Response] Surfacing noToolCalls=true (no generation triggered, no synthetic injection)');
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
    
    // Détecter les erreurs 402/429 et propager le bon status
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus = (error as any)?.status;
    
    if (errorStatus === 402 || errorMessage.includes('402') || errorMessage.includes('Payment required')) {
      return new Response(
        JSON.stringify({ 
          error: 'Payment required, please add funds to your Lovable AI workspace.',
          code: 'PAYMENT_REQUIRED'
        }), 
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (errorStatus === 429 || errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limits exceeded, please try again later.',
          code: 'RATE_LIMIT'
        }), 
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
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
