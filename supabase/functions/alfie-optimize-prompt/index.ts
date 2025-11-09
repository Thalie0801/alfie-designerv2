// supabase/functions/alfie-optimize-prompt/index.ts
// ============================================
// Alfie Optimize Prompt - Transformation de prompts utilisateur en directives précises
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { callAIWithFallback, enrichPromptWithBrandKit, type AgentContext } from "../_shared/aiOrchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GenType = "image" | "carousel" | "video";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Missing authorization", 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    if (!type || !["image", "carousel", "video"].includes(type)) {
      return jsonError("Missing or invalid 'type' (image|carousel|video)", 400);
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

    // --- Messages for LLM ---
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
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
          `}`,
      },
    ];

    // --- Call AI (prefer Gemini for visuel) ---
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

function safeJsonFromContent<T = any>(content: string): T | null {
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
  // carousel (we optimize text-to-visual consistency)
  return "inconsistent style across slides, mismatched colors, illegible typography, excessive clutter, off-brand colors";
}

function defaultETA(type: GenType): string {
  if (type === "video") return "≈ 1–3 minutes (short clip)";
  if (type === "carousel") return "≈ 20–60 seconds (per slide)";
  return "≈ 10–20 seconds";
}

function suggestAspectRatio(
  type: GenType,
  provided: string | undefined,
  prompt: string,
): "1:1" | "4:5" | "9:16" | "16:9" {
  // If client already passed a known AR, keep it
  if (["1:1", "4:5", "9:16", "16:9"].includes(String(provided))) {
    return provided as any;
  }

  const t = prompt.toLowerCase();
  // Heuristics by keywords
  if (/(story|reel|tiktok|short|vertical)/i.test(t)) return "9:16";
  if (/(youtube|banni[eè]re|cover|landscape|widescreen)/i.test(t)) return "16:9";
  if (type === "carousel") return "4:5"; // Instagram carousel meta-friendly
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
