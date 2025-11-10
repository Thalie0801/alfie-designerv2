// --- imports ---
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { userHasAccess } from "../_shared/access.ts";
import { callAIWithFallback, type AgentContext, type AIResponse } from "../_shared/aiOrchestrator.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, env, LOVABLE_API_KEY } from "../_shared/env.ts";

/* ------------------------------------------
 * Helpers très simples
 * ----------------------------------------*/
function detectIntent(message: string): string {
  const lowerMessage = (message || "").toLowerCase();

  if (/(carrousel|carousel|slides?)/i.test(lowerMessage)) return "carousel";
  if (/(vidéo|video)/i.test(lowerMessage)) return "video";
  if (/(image|visuel|photo)/i.test(lowerMessage)) return "image";
  if (/(crédit|quota|woofs?)/i.test(lowerMessage)) return "credits";
  if (/(brand\s*kit|marque)/i.test(lowerMessage)) return "brandkit";
  return "autre";
}

function isApproval(message: string): boolean {
  const lower = (message || "").trim().toLowerCase();
  const approvalPhrases = [
    "oui", "ok", "d'accord", "go", "je valide", "lance", "vas-y", "parfait",
    "c'est bon", "yes", "yep", "ouais", "exact", "carrément", "absolument",
    "très bien", "impec", "nickel", "top",
  ];
  return approvalPhrases.some(
    (phrase) => lower === phrase || lower.startsWith(phrase + " "),
  );
}

// --- AI config (ASCII only) ---
const AI_CONFIG = {
  model: env("ALFIE_AI_MODEL") ?? "google/gemini-2.5-flash",
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
    const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");

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
    const {
      messages,
      brandId,
      stream = false,
      expertMode = false,
      forceTool,
    } = await req.json();

    console.log("[TRACE] Parsed request body:", {
      messagesCount: messages?.length || 0,
      brandId: brandId || "none",
      expertMode,
      forceTool: forceTool || "none",
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error("[TRACE] ❌ Missing or empty messages array");
      return new Response(
        JSON.stringify({ error: "Messages array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

      // Force vidéo (intent immédiat pour UI)
    if (forceTool === "generate_video") {
      const msg =
        "🎬 Tu veux quel format vidéo ? 9:16 (vertical TikTok/Reel) ou 16:9 (paysage YouTube) ?";
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: msg } }],
          requiresInput: true,
          formatOptions: ["9:16", "16:9"],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Récupérer Brand Kit
    let brandKit:
      | {
          name: string;
          colors: string[];
          fonts: any[];
          voice?: string;
          niche?: string;
        }
      | null = null;

    let brandContext = "";

    if (brandId) {
      const { data: brand } = await supabase
        .from("brands")
        .select("name, palette, fonts, voice, niche")
        .eq("id", brandId)
        .single();

      if (brand) {
        brandKit = {
          name: brand.name,
          colors: brand.palette || [],
          fonts: brand.fonts || [],
          voice: brand.voice || undefined,
          niche: brand.niche || undefined,
        };

        console.log("[TRACE] BrandKit loaded:", {
          name: brand.name,
          colorsCount: brand.palette?.length || 0,
          fontsCount: brand.fonts?.length || 0,
          voice: brand.voice,
        });

        const colorList =
          brand.palette
            ?.map((c: any) => (typeof c === "string" ? c : c?.hex || c?.value))
            .filter(Boolean)
            .join(", ") || "non défini";

        const fontsText = Array.isArray(brand.fonts)
          ? brand.fonts
              .map((f: any) => (typeof f === "string" ? f : f?.family || f?.name || String(f)))
              .join(", ")
          : typeof brand.fonts === "object" && brand.fonts !== null
          ? [
              brand.fonts?.primary,
              brand.fonts?.secondary,
              brand.fonts?.tertiary,
              brand.fonts?.headline,
              brand.fonts?.body,
            ]
              .filter(Boolean)
              .join(", ")
          : typeof brand.fonts === "string"
          ? brand.fonts
          : "";

        brandContext = `
📋 **BRAND KIT ACTIF - À RESPECTER DANS TOUTES LES CRÉATIONS:**

**Identité de marque:**
- Nom: ${brand.name}
- Secteur/Niche: ${brand.niche || "Non spécifié"}

**Palette couleurs (À UTILISER SYSTÉMATIQUEMENT):**
${colorList}

**Typographie:**
${fontsText || "Non définie"}

**Style & Ton:**
- Esthétique visuelle: ${brand.voice || "professionnel moderne"}
- Ton de communication: ${brand.voice || "professionnel engageant"}

⚠️ **RÈGLE CRITIQUE:** Tous les visuels générés DOIVENT intégrer ces couleurs et respecter ce style.
`;
      }
    }

    // Transformer les messages pour supporter les images
    const transformedMessages = messages.map((msg: any) => {
      if (msg?.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.imageUrl } },
          ],
        };
      }
      return msg;
    });

    // System Prompt
    const systemPrompt = `Tu es **Alfie** 🐾, assistant IA pour la création de contenu visuel.

🚨 **RÈGLE ABSOLUE : TOUJOURS UTILISER LES TOOLS**
Pour TOUTE demande de création, tu DOIS appeler un tool :
- **Carrousel** → classify_intent → plan_carousel → (après validation) create_carousel
- **Image** → classify_intent → generate_image
- **Vidéo** → classify_intent → generate_video
- **Crédits** → show_usage
- **Brand Kit** → show_brandkit

⛔ **INTERDIT :** Répondre en texte seul pour les demandes de création.

🚨 **FORMAT OBLIGATOIRE :**
1) Si format manquant → demande de format claire avec options
2) NE JAMAIS appeler generate_* / create_carousel / generate_video sans aspect confirmé

${brandContext}

## 🎯 STYLE
Chaleureux, motivant, tutoiement, emojis naturels. Phrases courtes.

## ⚡ WORKFLOW RAPIDE
- Carrousel: demander réseau/slides/objectif/FORMAT → plan_carousel → validation → create_carousel
- Image/Vidéo: demander FORMAT en premier (1:1, 4:5, 9:16, 16:9) → generate_image / generate_video

${
  expertMode
    ? "## 🧠 MODE EXPERT: explique (brièvement) tes choix créatifs et l'alignement au Brand Kit."
    : ""
}
Utilise **classify_intent** en premier !`;

    // Tools
    console.log("[TRACE] Building tools array...");
    let tools: any[] = [];
    try {
      tools = [
        {
          type: "function",
          function: {
            name: "classify_intent",
            description:
              "Classify user request intent (image/carousel/video/autre). Use FIRST before any generation.",
            parameters: {
              type: "object",
              properties: {
                user_message: {
                  type: "string",
                  description: "The user's message to classify",
                },
              },
              required: ["user_message"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "browse_templates",
            description:
              "Search for Canva templates based on criteria like category, keywords, or ratio",
            parameters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description:
                    "Template category (e.g., 'social_media', 'marketing')",
                },
                keywords: {
                  type: "string",
                  description: "Keywords for titles/descriptions",
                },
                ratio: {
                  type: "string",
                  description: "Aspect ratio: '1:1','16:9','9:16','4:5'",
                },
                limit: { type: "number", description: "Max results (default 5)" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "show_brandkit",
            description: "Show the user's current Brand Kit (colors, logo, fonts)",
            parameters: { type: "object", properties: {} },
          },
        },
        {
          type: "function",
          function: {
            name: "open_canva",
            description:
              "Open a Canva template or import a generated image into Canva",
            parameters: {
              type: "object",
              properties: {
                template_url: { type: "string" },
                generated_image_url: { type: "string" },
                template_title: { type: "string" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "generate_ai_version",
            description:
              "Generate an AI-styled version of a template using Nano-Banana (costs 1 credit)",
            parameters: {
              type: "object",
              properties: {
                template_image_url: { type: "string" },
                template_title: { type: "string" },
                style_instructions: { type: "string" },
              },
              required: ["template_image_url"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "check_credits",
            description: "Check the user's remaining AI generation credits",
            parameters: { type: "object", properties: {} },
          },
        },
        {
          type: "function",
          function: {
            name: "generate_image",
            description:
              "Generate an image from a text prompt (1 crédit). CRITICAL: Always include Brand Kit colors in your prompt.",
            parameters: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "4:5", "9:16", "16:9"],
                },
                reasoning: { type: "string" },
              },
              required: ["prompt"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "improve_image",
            description:
              "Improve an existing image with AI (1 crédit). User must provide image URL.",
            parameters: {
              type: "object",
              properties: {
                image_url: { type: "string" },
                instructions: { type: "string" },
              },
              required: ["image_url", "instructions"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "generate_video",
            description:
              "Generate a video. Cost: 1 Woof (5-15s). aspectRatio required.",
            parameters: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                aspectRatio: { type: "string", enum: ["16:9", "9:16"] },
                imageUrl: { type: "string" },
              },
              required: ["prompt"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "show_usage",
            description:
              "Show the user's current quota usage (visuals, videos, Woofs)",
            parameters: { type: "object", properties: {} },
          },
        },
        {
          type: "function",
          function: {
            name: "adapt_template",
            description:
              "Apply Brand Kit to a Canva template (colors, logo, fonts).",
            parameters: {
              type: "object",
              properties: {
                template_id: { type: "string" },
                template_title: { type: "string" },
              },
              required: ["template_id"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "package_download",
            description:
              "Prepare a ZIP package with download links for generated assets",
            parameters: {
              type: "object",
              properties: {
                asset_ids: { type: "array", items: { type: "string" } },
                filter_type: { type: "string", enum: ["images", "videos", "all"] },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "plan_carousel",
            description:
              "Generate a structured text plan for a carousel (returns JSON, no images).",
            parameters: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                count: { type: "number" },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "4:5", "9:16", "16:9"],
                },
              },
              required: ["prompt"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_carousel",
            description:
              "Create & generate the carousel slides after user validates the plan.",
            parameters: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                count: { type: "number" },
                aspect_ratio: {
                  type: "string",
                  enum: ["1:1", "4:5", "9:16", "16:9"],
                },
              },
              required: ["prompt", "count"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "generate_carousel_slide",
            description:
              "Generate a single carousel slide image from validated text content",
            parameters: {
              type: "object",
              properties: {
                slideIndex: { type: "number" },
                slideContent: { type: "object" },
                aspect_ratio: { type: "string", enum: ["1:1", "4:5"] },
              },
              required: ["slideIndex", "slideContent"],
            },
          },
        },
      ];
      console.log("[TRACE] ✅ Tools array built successfully:", tools.length, "tools");
    } catch (err) {
      console.error("[TRACE] ❌ Error building tools array:", err);
      throw err;
    }

    // Contexte
    const context: AgentContext = {
      brandKit: brandKit
        ? {
            name: brandKit.name,
            colors: brandKit.colors,
            fonts: brandKit.fonts,
            voice: brandKit.voice,
            style: brandKit.voice || "modern professional",
            niche: brandKit.niche,
          }
        : undefined,
      conversationHistory: transformedMessages,
      userMessage:
        transformedMessages[transformedMessages.length - 1]?.content || "",
    };

    console.log("[TRACE] Context built:", {
      hasBrandKit: !!context.brandKit,
      brandName: context.brandKit?.name,
      toolsCount: tools.length,
    });

    // ====== Boucle tool-calls ======
    let conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...transformedMessages,
    ];
    let aiResponse: AIResponse | null = null;
    let iterationCount = 0;
    const maxIterations = 5;
    const collectedAssets: any[] = [];
    let finalJobSetId: string | undefined;
    let fallbackAttempted = false;
    let syntheticInjectionDone = false;

    console.log("[TRACE] Starting tool execution loop...");

    while (iterationCount < maxIterations) {
      iterationCount++;
      console.log(`[Tool Loop] === Iteration ${iterationCount}/${maxIterations} ===`);

      // Pré-check quotas si 1ère itération & intent génération
      if (iterationCount === 1) {
        const lastUser = conversationMessages.filter((m) => m.role === "user").pop();
        const lastUserMessage =
          typeof lastUser?.content === "string"
            ? lastUser?.content
            : Array.isArray(lastUser?.content)
            ? lastUser?.content?.[0]?.text ?? ""
            : "";
        const detected = detectIntent(lastUserMessage);
        console.log(`[Pre-check] Detected intent: ${detected}`);

        if (["carousel", "image", "video"].includes(detected) && brandId) {
          try {
            const { data: quota, error: quotaError } = await supabase.functions.invoke(
              "get-quota",
              { body: { brand_id: brandId }, headers: functionHeaders },
            );
            if (!quotaError && quota?.data) {
              const woofsRemaining = quota.data?.woofs_remaining ?? 0;
              if (woofsRemaining === 0) {
                return new Response(
                  JSON.stringify({
                    error:
                      "Payment required, please add funds to your Lovable AI workspace.",
                    code: "PAYMENT_REQUIRED",
                  }),
                  {
                    status: 402,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  },
                );
              }
            }
          } catch (e) {
            console.warn("[Pre-check] Quota check failed, continue anyway:", e);
          }
        }
      }

      console.log(
        "[DEBUG] Messages sent to AI:",
        JSON.stringify(
          conversationMessages.map((m) => ({
            role: m.role,
            content:
              typeof m.content === "string"
                ? m.content.slice(0, 200) + "..."
                : m.content,
            tool_calls: m.tool_calls?.length || 0,
          })),
          null,
          2,
        ),
      );

      // Appel IA (OpenAI prioritaire pour tool calls)
      aiResponse = await callAIWithFallback(
        conversationMessages,
        context,
        tools,
        "openai",
        iterationCount - 1,
      );

      const assistantMessage: any = aiResponse.choices?.[0]?.message;
      if (!assistantMessage) throw new Error("No assistant message in AI response");

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        console.warn("[Tool Loop] ⚠️ No tool calls from AI");

        // Injection synthétique #1 (iteration 2) → classify_intent
        if (iterationCount === 2 && !syntheticInjectionDone) {
          const lastUser = conversationMessages.filter((m) => m.role === "user").pop();
          const lastUserMessage =
            typeof lastUser?.content === "string"
              ? lastUser?.content
              : Array.isArray(lastUser?.content)
              ? lastUser?.content?.[0]?.text ?? ""
              : "";
          console.log("[Synthetic] Injecting classify_intent...");

          syntheticInjectionDone = true;

          // On simule un call + résultat
          conversationMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "synthetic-classify",
                type: "function",
                function: {
                  name: "classify_intent",
                  arguments: JSON.stringify({ user_message: lastUserMessage }),
                },
              },
            ],
          });

          const detected = detectIntent(lastUserMessage);
          conversationMessages.push({
            role: "tool",
            tool_call_id: "synthetic-classify",
            name: "classify_intent",
            content: JSON.stringify({ intent: detected }),
          });
          continue;
        }

        // Injection synthétique #2 (iteration 3) → plan_carousel si intent carousel
        if (iterationCount === 3 && syntheticInjectionDone) {
          const lastUser = conversationMessages.filter((m) => m.role === "user").pop();
          const lastUserMessage =
            typeof lastUser?.content === "string"
              ? lastUser?.content
              : Array.isArray(lastUser?.content)
              ? lastUser?.content?.[0]?.text ?? ""
              : "";
          const detected = detectIntent(lastUserMessage);

          if (detected === "carousel") {
            console.log("[Synthetic] Injecting plan_carousel...");

            try {
              const { data: planData } = await supabase.functions.invoke(
                "alfie-plan-carousel",
                {
                  body: { prompt: lastUserMessage, slideCount: 5, brandKit: brandKit },
                  headers: functionHeaders,
                },
              );

              conversationMessages.push({
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "synthetic-plan",
                    type: "function",
                    function: {
                      name: "plan_carousel",
                      arguments: JSON.stringify({
                        prompt: lastUserMessage,
                        count: 5,
                      }),
                    },
                  },
                ],
              });

              conversationMessages.push({
                role: "tool",
                tool_call_id: "synthetic-plan",
                name: "plan_carousel",
                content: JSON.stringify(planData),
              });

              continue;
            } catch (e) {
              console.error("[Synthetic] plan_carousel failed:", e);
            }
          }
        }

        // Itération 1 : on force une relance avec rappel
        if (iterationCount === 1) {
          conversationMessages.push({
            role: "system",
            content:
              "⚠️ Tu DOIS appeler un tool (classify_intent, plan_carousel, create_carousel, generate_image, generate_video, etc.).",
          });
          continue;
        }

        // Fallback dur à partir itération 4
        if (iterationCount >= 4) {
          const lastUser = conversationMessages.filter((m) => m.role === "user").pop();
          const lastUserMessage =
            typeof lastUser?.content === "string"
              ? lastUser?.content
              : Array.isArray(lastUser?.content)
              ? lastUser?.content?.[0]?.text ?? ""
              : "";

          if (isApproval(lastUserMessage)) {
            // Cas approbation après plan carrousel → on exécute côté serveur
            // (simplifié ici : on renvoie une demande de format si manquant)
            return new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content:
                        "Parfait ! 📐 Choisis le format pour lancer le carrousel : 1:1, 4:5, 9:16 ou 16:9 ?",
                    },
                  },
                ],
                requiresInput: true,
                formatOptions: ["1:1", "4:5", "9:16", "16:9"],
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          // Intent image/vidéo → on prime une question de format et on relance
          const detected = detectIntent(lastUserMessage);
          if (detected === "image" || detected === "video") {
            conversationMessages.push({
              role: "assistant",
              content:
                detected === "image"
                  ? "Top ! Quel format pour l’image ? (1:1, 4:5, 9:16, 16:9)"
                  : "Super ! Quel format pour la vidéo ? (9:16 ou 16:9)",
            });
            continue;
          }
        }

        console.log("[Tool Loop] Fin: no tool calls");
        break;
      }

      // Ajoute le message assistant (avec tool calls)
      conversationMessages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: toolCalls,
      });

      // Exécuter chaque tool
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name;
        const toolArgs = JSON.parse(toolCall.function?.arguments || "{}");
        let toolResult: any = { error: "Tool not implemented" };

        try {
          switch (toolName) {
            case "classify_intent": {
              const { data: intentData } = await supabase.functions.invoke(
                "alfie-classify-intent",
                {
                  body: { user_message: toolArgs.user_message },
                  headers: functionHeaders,
                },
              );
              toolResult = intentData || { intent: "autre" };
              break;
            }

            case "plan_carousel": {
              const { data: planData, error: planError } = await supabase.functions.invoke(
                "alfie-plan-carousel",
                {
                  body: {
                    prompt: toolArgs.prompt,
                    slideCount: toolArgs.count || 5,
                    brandKit: brandKit || {},
                  },
                  headers: functionHeaders,
                },
              );
              if (planError) throw planError;
              toolResult = planData?.plan || planData || { slides: [] };
              break;
            }

            case "create_carousel": {
              if (!toolArgs.aspect_ratio) {
                return new Response(
                  JSON.stringify({
                    ok: true,
                    choices: [
                      {
                        message: {
                          role: "assistant",
                          content: "⚠️ Choisis un format 📐 : 1:1, 4:5, 9:16 ou 16:9",
                        },
                      },
                    ],
                    requiresInput: true,
                    formatOptions: ["1:1", "4:5", "9:16", "16:9"],
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
              }

              const count = toolArgs.count || 5;

              const { data: planResp } = await supabase.functions.invoke(
                "alfie-plan-carousel",
                {
                  body: {
                    messages,
                    brandId,
                    aspect_ratio: toolArgs.aspect_ratio,
                    slideCount: count,
                    brandKit: brandKit ?? {},
                    prompt: toolArgs.prompt,
                  },
                  headers: { Authorization: authHeader },
                },
              );

              const carouselPlan =
                toolArgs.plan ?? planResp?.plan ?? planResp ?? { slides: [] };
              const slides: any[] = Array.isArray(carouselPlan?.slides)
                ? carouselPlan.slides
                : [];

              const generatedImages: string[] = [];

              for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];

                // Proofread FR
                let correctedTitle = slide.title || "";
                let correctedSubtitle = slide.subtitle || "";
                try {
                  const { data: proofData } = await supabase.functions.invoke(
                    "alfie-proofread-fr",
                    {
                      body: { title: slide.title, subtitle: slide.subtitle },
                      headers: { Authorization: authHeader },
                    },
                  );
                  if (proofData?.data) {
                    correctedTitle = proofData.data.title || correctedTitle;
                    correctedSubtitle = proofData.data.subtitle || correctedSubtitle;
                  }
                } catch {
                  // noop
                }

                const aspectRatio = carouselPlan?.globals?.aspect_ratio ?? toolArgs.aspect_ratio;
                const format =
                  aspectRatio === "9:16"
                    ? "1024x1820"
                    : aspectRatio === "16:9"
                    ? "1820x1024"
                    : aspectRatio === "4:5"
                    ? "1024x1280"
                    : "1024x1024";

                // Step 1: background only
                let bgUrl: string | null = null;
                for (let r = 0; r < 3 && !bgUrl; r++) {
                  const { data: bgData } = await supabase.functions.invoke(
                    "alfie-render-image",
                    {
                      body: {
                        provider: "gemini_image",
                        prompt:
                          slide.note ??
                          "Abstract clean gradient background, center safe area, NO TEXT.",
                        format,
                        brand_id: brandId,
                        backgroundOnly: true,
                        slideIndex: i,
                        totalSlides: slides.length,
                        negativePrompt:
                          "text, typography, letters, watermarks, brand logos",
                      },
                      headers: { Authorization: authHeader },
                    },
                  );
                  bgUrl = bgData?.data?.image_urls?.[0] || null;
                }
                if (!bgUrl) continue;

                // Step 2: text overlay
                const overlayText = `${correctedTitle}\n${correctedSubtitle}`.trim();
                let finalUrl: string | null = null;
                for (let r = 0; r < 3 && !finalUrl; r++) {
                  const { data: overlayData } = await supabase.functions.invoke(
                    "alfie-add-text-overlay",
                    {
                      body: {
                        imageUrl: bgUrl,
                        overlayText,
                        brand_id: brandId,
                        slideIndex: i,
                        totalSlides: slides.length,
                        slideNumber: slide.slideNumber || `${i + 1}/${slides.length}`,
                        textContrast: slide.textContrast || "dark",
                        isLastSlide: i === slides.length - 1,
                        textPosition: "center",
                        fontSize: 48,
                      },
                      headers: { Authorization: authHeader },
                    },
                  );
                  finalUrl = overlayData?.data?.image_url || null;
                }

                generatedImages.push(finalUrl || bgUrl);
                collectedAssets.push({
                  type: "image",
                  url: finalUrl || bgUrl,
                  title: `Slide ${i + 1}/${slides.length}${
                    finalUrl === bgUrl ? " (bg only)" : ""
                  }`,
                  reasoning: slide.note || "",
                  brandAlignment: brandKit ? "Aligned with brand colors and voice" : "",
                });
              }

              toolResult = {
                success: true,
                slideCount: generatedImages.length,
                images: generatedImages,
              };
              break;
            }

            case "generate_image": {
              if (!toolArgs.aspect_ratio) {
                return new Response(
                  JSON.stringify({
                    ok: true,
                    choices: [
                      {
                        message: {
                          role: "assistant",
                          content: "⚠️ Format image ? 📐 1:1, 4:5, 9:16 ou 16:9",
                        },
                      },
                    ],
                    requiresInput: true,
                    formatOptions: ["1:1", "4:5", "9:16", "16:9"],
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
              }

              // Optimisation prompt avec BrandKit
              let optimizedPrompt: string = toolArgs.prompt || "professional visual";
              if (brandKit) {
                const { data: opt } = await supabase.functions.invoke(
                  "alfie-optimize-prompt",
                  {
                    body: {
                      prompt: toolArgs.prompt,
                      brandKit: {
                        palette: brandKit.colors ?? [],
                        voice: brandKit.voice,
                        niche: brandKit.niche,
                      },
                    },
                    headers: { Authorization: authHeader },
                  },
                );
                optimizedPrompt = opt?.optimizedPrompt ?? optimizedPrompt;
              }

              const aspectRatio: string = toolArgs.aspect_ratio;
              const format =
                aspectRatio === "9:16"
                  ? "1024x1820"
                  : aspectRatio === "16:9"
                  ? "1820x1024"
                  : aspectRatio === "4:5"
                  ? "1024x1280"
                  : "1024x1024";

              const { data: imageData, error: imageError } = await supabase.functions.invoke(
                "alfie-render-image",
                {
                  body: {
                    provider: "gemini_image",
                    prompt: optimizedPrompt,
                    format,
                    brand_id: brandId,
                  },
                  headers: { Authorization: authHeader },
                },
              );
              if (imageError) throw imageError;

              const url = imageData?.data?.image_urls?.[0];
              if (!url) throw new Error("Image generation returned no URL");

              collectedAssets.push({
                type: "image",
                url,
                rationale: toolArgs.reasoning,
                brandAlignment: brandKit ? "Brand kit applied" : undefined,
              });

              toolResult = {
                success: true,
                imageUrl: url,
                generationId: imageData?.generation_id,
              };
              break;
            }

            case "generate_video": {
              if (!toolArgs.aspectRatio) {
                return new Response(
                  JSON.stringify({
                    ok: true,
                    choices: [
                      {
                        message: {
                          role: "assistant",
                          content: "⚠️ Format vidéo ? 🎬 9:16 ou 16:9",
                        },
                      },
                    ],
                    requiresInput: true,
                    formatOptions: ["9:16", "16:9"],
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
              }

              const { data: videoData, error: videoError } = await supabase.functions.invoke(
                "generate-video",
                {
                  body: {
                    prompt: toolArgs.prompt,
                    aspect_ratio: toolArgs.aspectRatio,
                    brand_id: brandId,
                    imageUrl: toolArgs.imageUrl ?? null,
                  },
                  headers: { Authorization: authHeader },
                },
              );
              if (videoError) throw videoError;

              toolResult = {
                success: true,
                jobId: videoData?.jobId,
                status: "processing",
              };
              break;
            }

            case "check_credits":
            case "show_usage": {
              const { data: quota } = await supabase.functions.invoke("get-quota", {
                body: { brand_id: brandId },
                headers: { Authorization: authHeader },
              });

              toolResult = {
                woofs_remaining: quota?.woofs_remaining ?? 0,
                woofs_quota: quota?.woofs_quota ?? 0,
                visuals_remaining: quota?.visuals_remaining ?? 0,
                visuals_quota: quota?.visuals_quota ?? 0,
                plan: quota?.plan ?? "free",
              };
              break;
            }

            case "show_brandkit": {
              toolResult = {
                name: brandKit?.name ?? null,
                colors: brandKit?.colors ?? [],
                fonts: brandKit?.fonts ?? [],
                voice: brandKit?.voice ?? null,
                niche: brandKit?.niche ?? null,
              };
              break;
            }

            default: {
              console.warn(`[Tool Execution] Unknown tool: ${toolName}`);
              toolResult = { error: `Tool ${toolName} not implemented` };
            }
          }
        } catch (error: any) {
          console.error(`[Tool Execution] Error in ${toolName}:`, error);
          toolResult = { error: error?.message || "Tool execution failed" };
        }

        // Push tool result
        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult),
        });
      }
    }

    // Réponse finale
    const finalMessage = aiResponse?.choices?.[0]?.message;
    const responsePayload: any = {
      ok: true,
      choices: [
        {
          message: {
            role: "assistant",
            content: finalMessage?.content || "",
          },
        },
      ],
    };

    if (collectedAssets.length > 0) responsePayload.assets = collectedAssets;
    if (finalJobSetId) responsePayload.jobSetId = finalJobSetId;

    // Si aucun tool call et aucune injection → signaler à l'app
    if (collectedAssets.length === 0 && !finalJobSetId && !syntheticInjectionDone) {
      responsePayload.noToolCalls = true;
      console.warn(
        "[Response] Surfacing noToolCalls=true (no generation triggered, no synthetic injection)",
      );
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ERROR] alfie-chat crashed:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as any)?.status;

    if (status === 402 || /402|Payment required/i.test(msg)) {
      return new Response(
        JSON.stringify({
          error: "Payment required, please add funds to your Lovable AI workspace.",
          code: "PAYMENT_REQUIRED",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (status === 429 || /429|Rate limit/i.test(msg)) {
      return new Response(
        JSON.stringify({
          error: "Rate limits exceeded, please try again later.",
          code: "RATE_LIMIT",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
