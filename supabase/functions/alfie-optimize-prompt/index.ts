// supabase/functions/alfie-optimize-prompt/index.ts
// ============================================
// Alfie Optimize Prompt - Transformation de prompts utilisateur en directives précises
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { callAIWithFallback, enrichPromptWithBrandKit, type AgentContext } from "../_shared/aiOrchestrator.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

type GenType = "image" | "carousel" | "video" | "mini-film" | "campaign-pack";

interface MiniFilmScene {
  sceneIndex: number;
  visualPrompt: string;
  voiceoverText: string;
  durationSec: number;
}

interface CampaignPackAsset {
  type: "image" | "carousel" | "video";
  prompt: string;
  aspectRatio: string;
  description: string;
  slideCount?: number; // For carousels
}

interface CampaignPackPlan {
  theme: string;
  strategy: string;
  assets: CampaignPackAsset[];
}

interface OptimizationRequest {
  prompt: string;
  type: GenType;
  brandId?: string;
  aspectRatio?: string; // "1:1" | "4:5" | "9:16" | "16:9"
}

interface OptimizationResult {
  optimizedPrompt: string;
  reasoning: string;
  negativePrompt: string;
  suggestedAspectRatio?: string;
  estimatedGenerationTime?: string;
  brandAlignment?: string;
  scenes?: MiniFilmScene[];
  campaignPack?: CampaignPackPlan;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Missing authorization", 401);
    }
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonError("Unauthorized", 401);
    }

    // --- Parse & validate ---
    const body = (await req.json()) as OptimizationRequest;
    const { prompt, type, brandId, aspectRatio } = body ?? {};

    if (!prompt || typeof prompt !== "string") {
      return jsonError("Missing or invalid 'prompt'", 400);
    }
    if (!type || !["image", "carousel", "video", "mini-film", "campaign-pack"].includes(type)) {
      return jsonError("Missing or invalid 'type' (image|carousel|video|mini-film|campaign-pack)", 400);
    }

    // --- Load Brand Kit (optional) ---
    let brandKit: AgentContext["brandKit"] | undefined = undefined;
    if (brandId) {
      const { data: brand } = await supabase
        .from("brands")
        .select("name, palette, fonts, voice, niche")
        .eq("id", brandId)
        .maybeSingle();
      if (brand) {
        brandKit = {
          name: brand.name,
          colors: brand.palette || [],
          fonts: brand.fonts || [],
          voice: brand.voice,
          niche: brand.niche,
        };
      }
    }

    console.log("[Optimize Prompt] req", {
      type,
      hasBrandKit: !!brandKit,
      aspectRatio,
      promptLen: prompt.length,
    });

    // --- Build system prompt (per type) ---
    const systemPrompt = buildSystemPromptForType(type, brandKit);

    // --- Messages for LLM (adapt based on type) ---
    let userMessage = "";
    if (type === "campaign-pack") {
      userMessage =
        `User campaign request: "${prompt}"\n\n` +
        `Transform this into a complete campaign plan. Return JSON with exactly:\n` +
        `{\n` +
        `  "optimizedPrompt": "Global campaign direction and theme",\n` +
        `  "campaignPack": {\n` +
        `    "theme": "Campaign theme/concept",\n` +
        `    "strategy": "Marketing strategy explanation",\n` +
        `    "assets": [\n` +
        `      { "type": "image", "prompt": "detailed image prompt", "aspectRatio": "1:1", "description": "Asset purpose" },\n` +
        `      { "type": "carousel", "prompt": "detailed carousel prompt", "aspectRatio": "4:5", "description": "Asset purpose", "slideCount": 5 },\n` +
        `      { "type": "video", "prompt": "detailed video prompt", "aspectRatio": "9:16", "description": "Asset purpose" }\n` +
        `    ]\n` +
        `  },\n` +
        `  "reasoning": "explain strategy and Brand Kit alignment",\n` +
        `  "negativePrompt": "what to avoid",\n` +
        `  "estimatedGenerationTime": "total time estimate",\n` +
        `  "brandAlignment": "how it uses colors/voice"\n` +
        `}`;
    } else {
      userMessage =
        `User raw request: "${prompt}"\n\n` +
        `Aspect ratio: ${aspectRatio || "not specified"}\n\n` +
        `Transform this into an optimized prompt. Return JSON with exactly:\n` +
        `{\n` +
        `  "optimizedPrompt": "ultra-detailed ${type} prompt",\n` +
        `  "reasoning": "explain choices and Brand Kit alignment",\n` +
        `  "negativePrompt": "what to avoid",\n` +
        `  "suggestedAspectRatio": "optimal ratio",\n` +
        `  "estimatedGenerationTime": "short human estimate",\n` +
        `  "brandAlignment": "how it uses colors/voice"\n` +
        `}`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    // --- Call AI (prefer Gemini for visual) ---
    const aiResp = await callAIWithFallback(
      messages,
      { brandKit, userMessage: prompt },
      undefined,
      "gemini", // preferred provider
    );

    let content = aiResp?.choices?.[0]?.message?.content ?? "";
    if (!content || typeof content !== "string") {
      throw new Error("No optimization content from AI");
    }

    // --- Robust JSON parsing (handles ```json ... ``` blocks) ---
    const parsed = safeJsonFromContent<OptimizationResult>(content);
    let result: OptimizationResult | null = null;

    if (parsed) {
      result = parsed;
    } else {
      // Fallback: generate a minimal but consistent result
      const fallbackOptimized = enrichPromptWithBrandKit(prompt, brandKit);
      result = {
        optimizedPrompt: fallbackOptimized,
        reasoning: "Fallback optimization applied due to unparsable JSON response.",
        negativePrompt: defaultNegativePrompt(type),
        suggestedAspectRatio: suggestAspectRatio(type, aspectRatio, prompt),
        estimatedGenerationTime: defaultETA(type),
        brandAlignment: summarizeBrandAlignment(brandKit),
      };
    }

    // --- Ensure BrandKit enrichment & fields presence ---
    result.optimizedPrompt = ensureBrandInPrompt(result.optimizedPrompt, brandKit);
    result.negativePrompt = result.negativePrompt?.trim() || defaultNegativePrompt(type);

    if (!result.suggestedAspectRatio) {
      result.suggestedAspectRatio = suggestAspectRatio(type, aspectRatio, prompt);
    }
    if (!result.estimatedGenerationTime) {
      result.estimatedGenerationTime = defaultETA(type);
    }
    if (!result.brandAlignment) {
      result.brandAlignment = summarizeBrandAlignment(brandKit);
    }

    console.log("[Optimize Prompt] out", {
      optimizedLen: result.optimizedPrompt.length,
      suggestedAR: result.suggestedAspectRatio,
      hasCampaignPack: !!result.campaignPack,
      assetCount: result.campaignPack?.assets?.length,
    });

    return jsonOK({ ok: true, data: result });
  } catch (error) {
    console.error("[Optimize Prompt] Error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(message, 500);
  }
});

/* ---------------- Helpers ---------------- */

function jsonOK(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeJsonFromContent<T = unknown>(content: string): T | null {
  try {
    // Extract from fenced code block if present
    const m = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
    const raw = (m ? m[1] : content).trim();
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function ensureBrandInPrompt(optimized: string, brandKit?: AgentContext["brandKit"]): string {
  if (!brandKit) return optimized;

  const hasColors = brandKit.colors && Array.isArray(brandKit.colors) && brandKit.colors.length > 0;
  const colorsTxt = hasColors ? (brandKit.colors?.join(", ") ?? "") : "";
  const voiceTxt = brandKit.voice || "professional";

  const needColors = hasColors && !new RegExp(colorsTxt.slice(0, 6), "i").test(optimized);
  const needVoice = !new RegExp(voiceTxt.slice(0, 4), "i").test(optimized);

  let out = optimized;
  if (needColors) out += `\nColors (Brand Kit): ${colorsTxt}.`;
  if (needVoice) out += `\nStyle/Tone: ${voiceTxt}.`;

  return out;
}

function defaultNegativePrompt(type: GenType): string {
  if (type === "image") {
    return "text, letters, words, watermark, logo of third-party brands, low-res, blurry, distorted, artifacts, jpeg noise, overexposed, underexposed";
  }
  if (type === "video") {
    return "text overlays, shaky cam (unless requested), excessive noise, flicker, banding, compression artifacts, brand logos (3rd-party), watermarks";
  }
  if (type === "mini-film") {
    return "discontinuous character design, jarring style shifts between scenes, unrelated visual themes, inconsistent lighting across clips, audio-visual mismatch, abrupt transitions";
  }
  if (type === "campaign-pack") {
    return "inconsistent branding across assets, mismatched visual styles, off-brand colors, conflicting messaging, low-quality imagery, cluttered compositions";
  }
  // carousel (we optimize text-to-visual consistency)
  return "inconsistent style across slides, mismatched colors, illegible typography, excessive clutter, off-brand colors";
}

function defaultETA(type: GenType): string {
  if (type === "mini-film") return "≈ 2–5 minutes (multi-scènes)";
  if (type === "video") return "≈ 1–3 minutes (short clip)";
  if (type === "carousel") return "≈ 20–60 seconds (per slide)";
  if (type === "campaign-pack") return "≈ 3–8 minutes (selon le nombre d'assets)";
  return "≈ 10–20 seconds";
}

function suggestAspectRatio(
  type: GenType,
  provided: string | undefined,
  prompt: string,
): "1:1" | "4:5" | "9:16" | "16:9" | "mixed" {
  // If client already passed a known AR, keep it
  if (["1:1", "4:5", "9:16", "16:9"].includes(String(provided))) {
    return provided as "1:1" | "4:5" | "9:16" | "16:9";
  }

  // Campaign pack uses mixed ratios
  if (type === "campaign-pack") return "mixed" as any;

  const t = prompt.toLowerCase();
  // Heuristics by keywords
  if (/(story|reel|tiktok|short|vertical)/i.test(t)) return "9:16";
  if (/(youtube|banni[eè]re|cover|landscape|widescreen)/i.test(t)) return "16:9";
  if (type === "carousel") return "4:5"; // Instagram carousel meta-friendly
  if (type === "mini-film") return "9:16"; // Default vertical for social mini-films
  if (type === "video") return "16:9"; // Default for video when unsure
  return "1:1"; // Safe default for images
}

function summarizeBrandAlignment(brandKit?: AgentContext["brandKit"]): string {
  if (!brandKit) return "No Brand Kit provided.";
  const colors = Array.isArray(brandKit.colors) ? brandKit.colors.slice(0, 4).join(", ") : "";
  return `Uses brand voice "${brandKit.voice || "professional"}"${colors ? ` and colors: ${colors}` : ""}.`;
}

/* ---------------- System prompt builder ---------------- */

function buildSystemPromptForType(type: GenType, brandKit?: AgentContext["brandKit"]): string {
  const base =
    "You are Alfie, a senior prompt engineer for visual generation. " +
    "Transform raw user ideas into precise, production-ready prompts. " +
    "Always return strict JSON only (no commentary).";

  const brand = brandKit
    ? `\nBRAND KIT:\n- Colors: ${brandKit.colors?.join(", ") || "n/a"}\n- Voice: ${
        brandKit.voice || "professional"
      }\n- Niche: ${brandKit.niche || "general"}\n`
    : "\nBRAND KIT: none provided\n";

  if (type === "image") {
    return (
      base +
      brand +
      `
IMAGE PROMPTING GUIDELINES (Gemini / NanoBanana compatible):
- Composition: angle, framing, subject priority, rule-of-thirds
- Colors: explicit brand palette (HEX if available)
- Lighting: studio, natural, golden hour, rim light, soft shadows
- Mood: energetic, calm, premium, playful, etc.
- Quality: high-resolution, sharp, professional
- Style: photography / illustration / 3D render
- Background: readable, clean, no text overlays unless requested
- Output MUST be a single still image.

RESPONSE FORMAT: strict JSON with keys: optimizedPrompt, reasoning, negativePrompt, suggestedAspectRatio, estimatedGenerationTime, brandAlignment.
`
    );
  }

  if (type === "video") {
    return (
      base +
      brand +
      `
VIDEO PROMPTING GUIDELINES (Sora2/Seededance/Kling fallback):
- Camera: dolly, pan, zoom, static; position (eye-level, ground-level)
- Temporal structure: begin → middle → end
- Motion: subject and/or camera movement
- Cinematography: depth-of-field, stabilization, fps
- Palette & art direction: match Brand Kit
- Duration target: short clip
- Output MUST be a single coherent clip (no collage).

RESPONSE FORMAT: strict JSON with keys: optimizedPrompt, reasoning, negativePrompt, suggestedAspectRatio, estimatedGenerationTime, brandAlignment.
`
    );
  }

  if (type === "mini-film") {
    return (
      base +
      brand +
      `
MINI-FILM PROMPTING GUIDELINES (Multi-scene narrative):
- STRUCTURE: Generate a 3-5 scene script with visual continuity
- Each scene MUST have: visual_prompt, voiceover_text, duration (6-10 seconds each)
- NARRATIVE ARC: Hook scene (attention grabber) → Development (value/story) → Climax (peak moment) → CTA (call to action)
- VISUAL COHERENCE: Same character design, consistent color palette, unified artistic style across ALL scenes
- CAMERA VARIETY: Use different angles per scene (wide establishing, medium action, close-up emotional)
- TRANSITIONS: Suggest smooth narrative flow, avoid jarring cuts
- AUDIO: Include voiceover text in French with engaging, brand-aligned tone
- PACING: Build tension/interest progressively across scenes

RESPONSE FORMAT: strict JSON with keys:
{
  "optimizedPrompt": "global visual direction and style reference for all scenes",
  "scenes": [
    { "sceneIndex": 1, "visualPrompt": "detailed visual for scene 1", "voiceoverText": "French voiceover", "durationSec": 8 },
    { "sceneIndex": 2, "visualPrompt": "detailed visual for scene 2", "voiceoverText": "French voiceover", "durationSec": 8 },
    ...
  ],
  "reasoning": "explain narrative choices and brand alignment",
  "negativePrompt": "what to avoid across all scenes",
  "suggestedAspectRatio": "9:16 for social vertical",
  "estimatedGenerationTime": "2-5 minutes",
  "brandAlignment": "how scenes use brand colors/voice"
}
`
    );
  }

  if (type === "campaign-pack") {
    return (
      base +
      brand +
      `
CAMPAIGN PACK PROMPTING GUIDELINES (Multi-asset marketing campaign):
- OBJECTIVE: Create a cohesive multi-asset campaign based on the user's marketing intent
- ASSET MIX: Generate 3-5 assets with a strategic mix of:
  * Images (1-2): Hero visuals, product shots, lifestyle imagery
  * Carousels (1-2): Educational content, product features, storytelling
  * Videos (1): Dynamic content for engagement (Reels/TikTok style)
- VISUAL COHERENCE: All assets MUST share the same visual identity (colors, style, mood)
- MESSAGING: Each asset serves a specific purpose in the marketing funnel
- PLATFORM OPTIMIZATION: Suggest appropriate aspect ratios per asset type
- BRAND INTEGRATION: Every asset reflects the Brand Kit colors, voice, and niche

ASSET SPECIFICATIONS:
- Images: Detailed visual prompt, suggest 1:1 or 4:5 for social
- Carousels: Cohesive slide theme, 4-6 slides recommended, suggest 4:5
- Videos: Motion-focused prompt with hook, suggest 9:16 for Reels/TikTok

RESPONSE FORMAT: strict JSON with keys:
{
  "optimizedPrompt": "Global campaign direction and unified visual theme",
  "campaignPack": {
    "theme": "Core campaign concept/message",
    "strategy": "How these assets work together in marketing funnel",
    "assets": [
      { 
        "type": "image", 
        "prompt": "Ultra-detailed image generation prompt", 
        "aspectRatio": "1:1", 
        "description": "Asset purpose: hero visual for feed" 
      },
      { 
        "type": "carousel", 
        "prompt": "Visual direction for all slides - consistent style", 
        "aspectRatio": "4:5", 
        "description": "Educational carousel about product benefits",
        "slideCount": 5
      },
      { 
        "type": "video", 
        "prompt": "Dynamic video prompt with motion and hook", 
        "aspectRatio": "9:16", 
        "description": "Engaging Reel for awareness" 
      }
    ]
  },
  "reasoning": "Explain marketing strategy and how assets complement each other",
  "negativePrompt": "What to avoid across the campaign",
  "estimatedGenerationTime": "3-8 minutes depending on asset count",
  "brandAlignment": "How campaign uses brand colors, voice, and positioning"
}
`
    );
  }

  // carousel
  return (
    base +
    brand +
    `
CAROUSEL PROMPTING GUIDELINES:
- Visual unity across slides (consistent palette, grid, spacing)
- Typography hierarchy consistent (title/subtitle)
- Composition rhythm per slide (breathing room for text)
- Backgrounds clean and text-friendly
- Image generation per slide should AVOID adding text itself (text overlaid later)
- Output is a structured visual direction for multiple slides.

RESPONSE FORMAT: strict JSON with keys: optimizedPrompt, reasoning, negativePrompt, suggestedAspectRatio, estimatedGenerationTime, brandAlignment.
`
  );
}
