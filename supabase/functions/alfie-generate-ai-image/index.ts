import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY,
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY 
} from '../_shared/env.ts';

import { corsHeaders } from "../_shared/cors.ts";
/* ------------------------------- CORS ------------------------------- */
function jsonRes(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    ...init,
  });
}

/* ------------------------------ Types ------------------------------ */
interface BrandKit {
  id?: string;
  name?: string;
  palette?: string[];
  logo_url?: string;
  fonts?: any;
  voice?: string;
}

interface GenerateRequest {
  userId?: string;
  brandId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  requestId?: string | null;
  templateImageUrl?: string;
  uploadedSourceUrl?: string | null;
  brandKit?: BrandKit;
  prompt?: string;
  resolution?: string;
  slideIndex?: number;
  totalSlides?: number;
  overlayText?: string;
  carouselId?: string;
  backgroundOnly?: boolean;
  seed?: string;
  negativePrompt?: string;
}

/* --------------------------- Small helpers -------------------------- */
const clampRes = (res?: string) => {
  // formats acceptés ; fallback en 1080x1350
  const ok = ["1080x1350", "1080x1080", "1920x1080", "1080x1920"];
  return ok.includes(String(res)) ? String(res) : "1080x1350";
};

const short = (s?: string, n = 300) => (s || "").slice(0, n);

function buildBackgroundOnlyPrompt(brand?: BrandKit) {
  return `Abstract background composition.
Style: ${brand?.voice || "modern, professional"}
Colors ONLY: ${brand?.palette?.join(", ") || "neutral tones"}

CRITICAL RULES:
- NO TEXT whatsoever
- NO LETTERS, NO WORDS, NO TYPOGRAPHY
- Pure visual: gradients, shapes, geometric patterns, textures
- Clean, minimal, suitable as background layer
- Leave center area lighter for text overlay`;
}

function buildMainPrompt(input: GenerateRequest): string {
  const {
    prompt,
    brandKit,
    backgroundOnly,
    overlayText,
    templateImageUrl,
    slideIndex,
    totalSlides,
    resolution,
    seed,
    negativePrompt,
  } = input;

  const res = clampRes(resolution);

  let fullPrompt = prompt || "Create a high-quality marketing visual based on the description";

  // Mode background pur
  if (backgroundOnly) {
    fullPrompt = buildBackgroundOnlyPrompt(brandKit);
  } else {
    // Mode normal : forcing overlayText exact si présent
    if (overlayText) {
      fullPrompt += `\n\n--- EXACT TEXT TO OVERLAY ---`;
      fullPrompt += `\nUse EXACTLY this French text, word-for-word, no additions, no modifications:`;
      fullPrompt += `\n« ${overlayText} »`;
      fullPrompt += `\n--- END EXACT TEXT ---`;
    }
  }

  // Contexte carrousel (UNE SEULE slide)
  if (typeof slideIndex === "number" && typeof totalSlides === "number" && totalSlides > 1) {
    fullPrompt += `\n\nIMPORTANT: This is slide ${slideIndex + 1} of ${totalSlides} in a carousel.`;
    fullPrompt += `\nGenerate ONLY slide ${slideIndex + 1} of ${totalSlides}. Create ONE SINGLE standalone image, NOT a collage or grid of multiple slides.`;
    fullPrompt += `\nEach slide should be a complete, independent visual that works on its own.`;
    if (templateImageUrl) {
      fullPrompt += `\nKeep the same visual style as the reference image (colors, typography vibe, spacing, text placement).`;
      fullPrompt += `\nMaintain visual coherence with the first slide while adapting the content.`;
    }
  }

  // Brand info si pas backgroundOnly
  if (!backgroundOnly) {
    if (brandKit?.palette?.length) fullPrompt += `\n\nBrand Colors: ${brandKit.palette.join(", ")}`;
    if (brandKit?.voice) fullPrompt += `\nBrand Voice: ${brandKit.voice}`;
  }

  // Infos tech libres
  if (seed) fullPrompt += `\nSeed (hint): ${seed}`;
  if (!backgroundOnly && negativePrompt) {
    fullPrompt += `\nNegative prompt (constraints): ${negativePrompt}`;
  }

  fullPrompt += `\n\nTarget resolution: ${res}`;

  return fullPrompt;
}

function buildSystemPrompt(resolution?: string) {
  const res = clampRes(resolution);
  return `You are a professional image generator specialized in creating stunning visuals for social media and marketing.

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
- If overlayText is provided, reproduce it EXACTLY as given - no modifications, no additions
- If a reference image is provided, maintain similar composition, style, color palette, typography vibe, and text placement
- Always produce exactly ONE high-quality image in message.images[0]
- For carousels: generate ONE slide at a time, not a grid or collage. One canvas, no tiles, no multiple frames
- Generate high-quality images suitable for ${res} resolution with good contrast and readability`;
}

function buildNegativePrompt(input: GenerateRequest) {
  if (input.backgroundOnly) {
    return "text, letters, words, typography, captions, labels, signs, writing, alphabet, characters, numbers";
  }
  return input.negativePrompt || "";
}

async function callLovableOnce(opts: { apiKey: string; system: string; userContent: any[] }) {
  const { apiKey, system, userContent } = opts;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      modalities: ["image", "text"],
    }),
  });

  return resp;
}

/* ------------------------------- Handler ------------------------------ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase env not configured");
    }
    if (!INTERNAL_FN_SECRET) throw new Error("INTERNAL_FN_SECRET not configured");

    const body = (await req.json()) as GenerateRequest;

    const secret = req.headers.get("X-Internal-Secret");
    if (secret !== INTERNAL_FN_SECRET) {
      return jsonRes({ error: "Forbidden" }, { status: 403 });
    }

    const userId = typeof body.userId === "string" ? body.userId : null;
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const orderId = typeof body.orderId === "string" ? body.orderId : null;
    const orderItemId = typeof body.orderItemId === "string" ? body.orderItemId : null;
    const requestId = typeof body.requestId === "string" ? body.requestId : null;

    if (!userId) {
      return jsonRes({ error: "Missing userId" }, { status: 400 });
    }
    if (!orderId) {
      console.warn("[alfie-generate-ai-image] Missing orderId in payload");
    }

    const sbService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Construire prompts & payload ---
    const systemPrompt = buildSystemPrompt(body.resolution);
    const fullPrompt = buildMainPrompt(body);
    const negative = buildNegativePrompt(body);

    const referenceImage =
      body.uploadedSourceUrl?.trim() || body.templateImageUrl?.trim() || null;
    const userContent: any[] = [{ type: "text", text: fullPrompt }];
    if (referenceImage) {
      userContent.push({ type: "image_url", image_url: { url: referenceImage } });
    }
    if (negative) {
      // On peut glisser le negative prompt explicitement dans le message
      userContent.push({ type: "text", text: `Negative prompt: ${negative}` });
    }

    // --- 1er appel Lovable ---
    const resp = await callLovableOnce({
      apiKey: LOVABLE_API_KEY,
      system: systemPrompt,
      userContent,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Lovable error:", resp.status, short(errText, 500));

      if (resp.status === 429)
        return jsonRes({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
      if (resp.status === 402)
        return jsonRes({ error: "Insufficient credits. Please add credits to your workspace." }, { status: 402 });

      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const data = await resp.json();
    let generatedImageUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    // --- Retry unique si pas d'image ---
    if (!generatedImageUrl) {
      const retryPrompt =
        fullPrompt +
        "\n\nIMPORTANT: You MUST return an image. Generate a single canvas, no tiles, no grids, no multiple frames. One composition.";
      const retryContent = [{ type: "text", text: retryPrompt }] as any[];
      if (referenceImage) {
        retryContent.push({ type: "image_url", image_url: { url: referenceImage } });
      }
      if (negative) retryContent.push({ type: "text", text: `Negative prompt: ${negative}` });

      const retry = await callLovableOnce({
        apiKey: LOVABLE_API_KEY,
        system:
          "You are a professional image generator. Always produce exactly ONE high-quality image in message.images[0]. Use PERFECT French spelling with proper accents.",
        userContent: retryContent,
      });

      const retryJson = await retry.json().catch(() => null);
      generatedImageUrl = retryJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!generatedImageUrl) throw new Error("No image generated");
    }

    // --- Sauvegarde bibliothèque ---
    let saved = false;
    let errorDetail: string | null = null;

    try {
      const brandIdForMetadata = brandId ?? (typeof body.brandKit?.id === "string" ? body.brandKit.id : null);
      const slideIdx = typeof body.slideIndex === "number" ? body.slideIndex : null;
      const totalSlides = typeof body.totalSlides === "number" ? body.totalSlides : null;

      const insertPayload = {
        user_id: userId,
        brand_id: brandIdForMetadata,
        order_id: orderId ?? null,
        order_item_id: orderItemId,
        type: "image" as const,
        status: "completed" as const,
        // On log uniquement un résumé court pour conformité
        prompt: short(fullPrompt, 500),
        output_url: generatedImageUrl!,
        thumbnail_url: generatedImageUrl!,
        woofs: 1,
        metadata: {
          resolution: clampRes(body.resolution),
          brandName: body.brandKit?.name ?? null,
          slideIndex: slideIdx,
          totalSlides,
          carouselId: body.carouselId ?? null,
          overlayText: body.overlayText ?? null,
          backgroundOnly: !!body.backgroundOnly,
          seed: body.seed ?? null,
          negativePrompt: body.negativePrompt ?? null,
          generatedAt: new Date().toISOString(),
          engine: "gemini-2.5-flash-image-preview",
          orderId,
          orderItemId,
          requestId,
          referenceImageUrl: referenceImage ?? null,
        },
      };

      const { data: inserted, error: insertError } = await sbService
        .from("media_generations")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        console.error("Save error:", insertError);
        errorDetail = insertError.message ?? "insert error";
      } else {
        console.log(`Saved media id=${inserted?.id} user=${userId} brand=${brandIdForMetadata ?? "null"}`);
        saved = true;
      }
    } catch (e: any) {
      console.error("Save exception:", e?.message || e);
      errorDetail = String(e?.message || e);
    }

    return jsonRes({
      imageUrl: generatedImageUrl,
      message: data?.choices?.[0]?.message?.content || "Image générée avec succès",
      saved,
      errorDetail,
    });
  } catch (error) {
    console.error("Error in alfie-generate-ai-image:", error);
    return jsonRes({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
