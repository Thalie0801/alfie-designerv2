// functions/alfie-render-carousel-slide/index.ts
// v2.7.0 — Slide renderer with Vertex AI Gemini 2.5 priority + Lovable fallback

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { uploadTextAsRaw } from "../_shared/cloudinaryUploader.ts";
import { buildCarouselSlideUrl, Slide, CarouselType } from "../_shared/imageCompositor.ts";
import { getCarouselModel, getVertexCarouselModel, LOVABLE_MODELS } from "../_shared/aiModels.ts";
import { callVertexGeminiImage, isVertexGeminiConfigured } from "../_shared/vertexGeminiImage.ts";
import { 
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY, 
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY 
} from "../_shared/env.ts";

import { corsHeaders } from "../_shared/cors.ts";
type Lang = "FR" | "EN";

type CarouselMode = 'standard' | 'premium';

interface BrandKit {
  name?: string;
  niche?: string;
  voice?: string;
  pitch?: string;
  adjectives?: string[];
  visual_types?: string[];
  visual_mood?: string[];
  avoid_in_visuals?: string;
  palette?: string[];
}

interface SlideRequest {
  userId?: string;               // ✅ Required or deduced from orderId
  prompt: string;
  globalStyle: string;
  slideContent: {
    title: string;
    subtitle?: string;
    body?: string;
    bullets?: string[];
    alt: string;
    author?: string; // ✅ Auteur pour les citations
  };
  brandId: string;
  orderId: string;
  orderItemId?: string | null;
  carouselId: string;
  slideIndex: number;
  totalSlides: number;
  aspectRatio: string;           // "4:5" / "1080x1350" etc.
  textVersion: number;
  renderVersion: number;
  campaign: string;
  language?: Lang | string;
  requestId?: string | null;
  useBrandKit?: boolean;        // ✅ Contrôle si le Brand Kit doit être appliqué
  carouselMode?: CarouselMode;  // ✅ Standard (overlay) ou Premium (texte intégré nativement)
  carouselType?: CarouselType;  // ✅ NOUVEAU: citations ou content
  brandKit?: BrandKit;          // ✅ NOUVEAU: Brand Kit V2 complet
  referenceImageUrl?: string | null; // ✅ NOUVEAU: Image de référence pour le style
}

type GenSize = { w: number; h: number };

// ✅ Modèles Lovable AI (fallback uniquement)
const MODEL_IMAGE_STANDARD = LOVABLE_MODELS.image_standard;
const MODEL_IMAGE_PREMIUM = LOVABLE_MODELS.image_premium;

const AR_MAP: Record<string, GenSize> = {
  "1:1":  { w: 1024, h: 1024 },
  "4:5":  { w: 1024, h: 1280 },
  "9:16": { w: 720,  h: 1280 },
  "16:9": { w: 1280, h: 720 },
};

const PIXEL_TO_AR: Record<string, string> = {
  "1080x1350": "4:5",
  "1080x1920": "9:16",
  "1920x1080": "16:9",
  "1080x1080": "1:1",
};

// -----------------------------
// Small helpers
// -----------------------------
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeLang(l?: string): Lang {
  return (l?.toUpperCase() === "EN" ? "EN" : "FR") as Lang;
}

function normalizeAspectRatio(ar: string | undefined): { ar: string; size: GenSize } {
  let ratio = (ar || "").trim();

  if (ratio.includes("x")) {
    const key = ratio.toLowerCase();
    ratio = PIXEL_TO_AR[key] || "4:5";
    console.log(`[render-slide] ℹ️ normalized pixel AR "${ar}" -> "${ratio}"`);
  }
  if (!AR_MAP[ratio]) {
    console.warn(`[render-slide] ⚠️ unknown AR "${ar}", fallback to 4:5`);
    ratio = "4:5";
  }
  return { ar: ratio, size: AR_MAP[ratio] };
}

function getSlideRole(index: number, total: number): string {
  if (index === 0) return "HOOK/INTRODUCTION";
  if (index === total - 1) return "CALL-TO-ACTION/CONCLUSION";
  if (index === 1) return "PROBLEM/CONTEXT";
  if (index === total - 2) return "SOLUTION/BENEFIT";
  return "KEY POINT/INSIGHT";
}

/**
 * Build prompt for STANDARD mode (PURE IMAGE ONLY - NO TEXT AT ALL)
 * Text is added AFTER via Cloudinary overlay
 * ✅ NE CONTIENT AUCUN TEXTE UTILISATEUR - uniquement des descriptions visuelles abstraites
 */
function buildImagePromptStandard(
  globalStyle: string, 
  prompt: string, 
  useBrandKit: boolean,
  slideContent: { title: string; subtitle?: string; alt: string },
  slideIndex: number,
  totalSlides: number
): string {
  // ✅ EXTRAIRE UNIQUEMENT LES CONCEPTS VISUELS, pas le texte brut
  // Convertir le prompt en thème abstrait sans phrases lisibles
  const extractVisualConcept = (rawPrompt: string): string => {
    if (!rawPrompt) return "modern professional design";
    
    // Mots-clés visuels à extraire
    const visualKeywords = rawPrompt.toLowerCase().match(
      /(tech|ia|ai|business|marketing|social|digital|créatif|innovation|productivité|santé|bien-être|nature|voyage|food|cuisine|fitness|mode|fashion|beauté|immobilier|finance|éducation|musique|art|sport)/gi
    );
    
    if (visualKeywords && visualKeywords.length > 0) {
      return `${visualKeywords[0]} themed visual, modern aesthetic`;
    }
    
    return "modern professional design";
  };
  
  const visualConcept = extractVisualConcept(prompt);
  
  const styleHint = useBrandKit && globalStyle 
    ? globalStyle 
    : "soft gradient background, pastel colors";
  
  return `Generate ONE abstract background illustration.

VISUAL CONCEPT: ${visualConcept}
STYLE: ${styleHint}

COMPOSITION:
- Abstract, elegant background with soft 3D elements
- Geometric shapes, gradients, subtle depth
- Clean central area for future overlay
- Professional social media aesthetic

=== CRITICAL RULE ===
This image must contain ZERO TEXT.
No letters. No words. No numbers. No labels. No typography.
Only abstract visual elements and colors.

OUTPUT: Pure abstract visual background.`
}

/**
 * Tronquer un texte intelligemment avec ellipsis
 */
function truncateText(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || "";
  const cutIndex = text.lastIndexOf(' ', maxChars - 3);
  return text.substring(0, cutIndex > maxChars * 0.5 ? cutIndex : maxChars - 3).trim() + "...";
}

/**
 * Build prompt for PREMIUM mode - TRUE NATIVE TEXT INTEGRATION
 * ✅ V5: Gemini 3 Pro génère l'image avec le texte INTÉGRÉ nativement
 * ✅ Si texte fourni → l'intégrer exactement
 * ✅ Si pas de texte → Gemini le génère et l'intègre
 * ✅ Si referenceImage → s'en inspirer pour le style
 */
function buildImagePromptPremium(
  userPrompt: string,
  brandKit: BrandKit | undefined,
  useBrandKit: boolean,
  slideContent: { title: string; subtitle?: string; body?: string; bullets?: string[]; alt: string },
  slideIndex: number,
  totalSlides: number,
  language: string = "FR",
  referenceImageUrl?: string | null
): string {
  // ✅ Vérifier si texte utilisateur fourni (pas un placeholder)
  const hasUserText = !!(
    slideContent.title?.trim() && 
    slideContent.title !== "Titre par défaut" &&
    slideContent.title !== "Slide" &&
    slideContent.title.length > 2
  );
  
  const isFR = language !== "EN";
  
  // ✅ INSTRUCTION ABSOLUE DE LANGUE
  const languageForce = isFR 
    ? `
=== LANGUAGE (ABSOLUTE MANDATORY RULE) ===
⚠️ WRITE ALL TEXT IN FRENCH ONLY.
⚠️ DO NOT USE ANY ENGLISH WORDS.
⚠️ Every single word, title, subtitle, and sentence MUST be in French.
⚠️ Example valid: "Découvrez nos conseils" - NOT "Discover our tips"
⚠️ Failure to use French = GENERATION FAILURE.`
    : `
=== LANGUAGE ===
Write all text in English.`;

  // ✅ Construire le bloc texte selon le cas
  let textInstruction: string;
  
  if (hasUserText) {
    // CAS 1: Texte fourni → Intégration EXACTE dans l'image
    const titleToDisplay = truncateText(slideContent.title, 50);
    const subtitleToDisplay = slideContent.subtitle ? truncateText(slideContent.subtitle, 100) : "";
    const bodyToDisplay = slideContent.body ? truncateText(slideContent.body, 120) : "";
    const bulletsToDisplay = slideContent.bullets?.length 
      ? slideContent.bullets.slice(0, 3).map(b => `• ${truncateText(b, 40)}`).join("\n") 
      : "";
    
    textInstruction = `
=== TEXT TO INTEGRATE NATIVELY IN THE IMAGE ===
TITLE: "${titleToDisplay}"
${subtitleToDisplay ? `SUBTITLE: "${subtitleToDisplay}"` : ""}
${bodyToDisplay ? `BODY TEXT: "${bodyToDisplay}"` : ""}
${bulletsToDisplay ? `BULLET POINTS:\n${bulletsToDisplay}` : ""}

Reproduce text EXACTLY as provided (spelling, accents, punctuation).
Text must be readable, professional, and NATIVELY INTEGRATED into the design.`;
  } else {
    // CAS 2: Pas de texte → Gemini GÉNÈRE et intègre
    const slideRole = getSlideRole(slideIndex, totalSlides);
    const tone = brandKit?.voice || (isFR ? "professionnel et engageant" : "professional and engaging");
    
    textInstruction = `
=== GENERATE AND INTEGRATE TEXT NATIVELY ===
Create ${isFR ? 'FRENCH' : 'English'} marketing text for slide ${slideIndex + 1}/${totalSlides}.
Role: ${slideRole}

GENERATE:
- TITLE: 3-5 impactful words (punchy, memorable) ${isFR ? 'IN FRENCH' : ''}
- SUBTITLE: 8-12 words explaining the point ${isFR ? 'IN FRENCH' : ''} (optional)

THEME: ${userPrompt}
TONE: ${tone}`;
  }
  
  // ✅ Style visuel enrichi par le Brand Kit V2
  let visualStyle = "soft gradient background, pastel colors, elegant modern design";
  if (useBrandKit && brandKit) {
    const styleParts: string[] = [];
    
    if (brandKit.niche) {
      styleParts.push(`${brandKit.niche} industry aesthetic`);
    }
    if (brandKit.visual_mood?.length) {
      styleParts.push(brandKit.visual_mood.slice(0, 2).join(", ") + " mood");
    }
    if (brandKit.visual_types?.length) {
      const type = brandKit.visual_types[0];
      if (type === "illustrations_3d") styleParts.push("3D rendered elements with depth");
      else if (type === "illustrations_2d") styleParts.push("flat 2D illustration style");
      else if (type === "photos") styleParts.push("photorealistic quality");
      else if (type === "mockups") styleParts.push("professional mockup style");
    }
    if (brandKit.palette?.length) {
      styleParts.push("harmonious brand color palette");
    }
    if (brandKit.pitch) {
      styleParts.push(`Brand essence: ${brandKit.pitch}`);
    }
    
    if (styleParts.length > 0) {
      visualStyle = styleParts.join(", ");
    }
  }
  
  // ✅ Éléments à éviter
  const avoid = brandKit?.avoid_in_visuals || "";

  // ✅ Instruction pour image de référence
  const referenceInstruction = referenceImageUrl ? `
=== REFERENCE IMAGE STYLE ===
Use the provided reference image as style inspiration.
Match its color palette, composition style, and overall aesthetic.` : "";

  return `Create ONE premium social media slide image for a carousel.

VISUAL CONCEPT: ${userPrompt}
STYLE: ${visualStyle}

${languageForce}

${textInstruction}

=== POSITIONING (ABSOLUTE RULES - DO NOT DEVIATE) ===
1. TEXT MUST BE **PERFECTLY CENTERED HORIZONTALLY**
   - Equal margins LEFT and RIGHT (MINIMUM 15% of image width on each side)
   - Text block must occupy AT MOST 70% of image width
   - NEVER allow text to touch or approach edges
   
2. VERTICAL PLACEMENT:
   - Title: UPPER-CENTER (approximately 25-35% from top, NOT at very top)
   - Subtitle/Body: DIRECTLY BELOW title with 5% vertical gap
   - All text must be in TOP HALF of image
   
3. SAFE ZONE (MANDATORY):
   - ALL text must stay within the CENTER 70% of the image width
   - 15% margin on LEFT edge (text cannot enter this zone)
   - 15% margin on RIGHT edge (text cannot enter this zone)
   - 20% margin from TOP edge
   - 35% margin from BOTTOM edge (keep bottom clean)

=== TYPOGRAPHY SIZE (STRICT LIMITS) ===
1. TITLE:
   - Maximum 8 words per line
   - If longer than 8 words: SPLIT into 2 lines
   - Font size: LARGE but proportional
   - Width: MAXIMUM 60% of image width
   
2. SUBTITLE/BODY:
   - Maximum 12 words per line
   - Font size: 40-50% of title size
   - Width: MAXIMUM 65% of image width

3. NEVER let text:
   - Extend beyond safe zone
   - Touch image edges
   - Get cut off or cropped

=== CONTRAST (MANDATORY - HIGH VISIBILITY) ===
1. THICK BLACK DROP SHADOW on ALL text:
   - Offset: 6px down, 4px right
   - Blur/spread: 12-15px
   - Color: Pure black or very dark gray
   
2. Text color: PURE WHITE (#FFFFFF)

3. Text must be 100% readable at FIRST GLANCE on any background

${referenceInstruction}

COMPOSITION:
- Single cohesive image, ready to post
- Professional Instagram/LinkedIn quality
- Slide ${slideIndex + 1}/${totalSlides} - maintain visual consistency
- Text integrated as part of the design, not floating
- Clean, balanced layout with clear visual hierarchy

${avoid ? `AVOID: ${avoid}` : ""}

OUTPUT: Professional carousel slide with text NATIVELY integrated, PERFECTLY CENTERED, with HIGH CONTRAST.`;
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, ms = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetries(url: string, init: RequestInit, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    const res = await fetchWithTimeout(url, init, 30000);
    if (res.ok) return res;

    const body = await res.text().catch(() => "");
    const is429 = res.status === 429;
    const is5xx = res.status >= 500 && res.status <= 599;

    if ((is429 || is5xx) && attempt < maxRetries) {
      const wait = Math.round(Math.pow(1.8, attempt + 1) * 800); // 1.44s, 2.59s
      console.warn(`[render-slide] ⏳ retry ${attempt + 1}/${maxRetries} after ${wait}ms (status=${res.status})`);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
      continue;
    }
    // propagate last response (non ok)
    return new Response(body, { status: res.status, headers: res.headers });
  }
}

// -----------------------------
// Handler
// -----------------------------
Deno.serve(async (req) => {
  console.log("[alfie-render-carousel-slide] v2.5.0 — invoked");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ✅ Validate internal secret FIRST
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== INTERNAL_FN_SECRET) {
    console.error("[alfie-render-carousel-slide] ❌ Invalid or missing internal secret");
    return json({ error: "Forbidden: invalid internal secret" }, 403);
  }

  // ✅ ENV validation using imported variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LOVABLE_API_KEY) {
    console.error("[alfie-render-carousel-slide] ❌ Missing critical env vars");
    return json({ error: "Missing required environment variables" }, 500);
  }

  try {
    const params = (await req.json()) as SlideRequest;
    let {
      userId,
      prompt,
      globalStyle,
      slideContent,
      brandId,
      orderId,
      orderItemId,
      carouselId,
      slideIndex,
      totalSlides,
      aspectRatio,
      textVersion,
      renderVersion,
      campaign,
      language = "FR",
      requestId = null,
      useBrandKit = true, // ✅ Par défaut : utiliser le Brand Kit
      carouselMode = 'standard', // ✅ Par défaut : Standard (overlay Cloudinary)
      carouselType = 'content', // ✅ Par défaut : Content (conseils/astuces)
      brandKit, // ✅ NOUVEAU: Brand Kit V2 complet
      referenceImageUrl, // ✅ NOUVEAU: Image de référence pour le style
    } = params;
    
    // ✅ Sélectionner le modèle selon le mode
    const MODEL_IMAGE = carouselMode === 'premium' ? MODEL_IMAGE_PREMIUM : MODEL_IMAGE_STANDARD;
    console.log(`[render-slide] 🎨 Mode: ${carouselMode} - Model: ${MODEL_IMAGE}`);

    // —— Supabase admin client (service role)
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // —— Validations d'entrée minimales
    const missing: string[] = [];
    if (!prompt) missing.push("prompt");
    if (!globalStyle) missing.push("globalStyle");
    if (!slideContent?.title) missing.push("slideContent.title");
    if (!slideContent?.alt) missing.push("slideContent.alt");
    if (!brandId) missing.push("brandId");
    if (!orderId) missing.push("orderId");
    if (!carouselId) missing.push("carouselId");

    if (!Number.isInteger(slideIndex) || slideIndex < 0) {
      missing.push("slideIndex(non-negative integer)");
    }
    if (!Number.isInteger(totalSlides) || totalSlides <= 0) {
      missing.push("totalSlides(positive integer)");
    }
    if (Number.isInteger(slideIndex) && Number.isInteger(totalSlides) && slideIndex >= totalSlides) {
      missing.push(`slideIndex(${slideIndex}) < totalSlides(${totalSlides})`);
    }

    if (missing.length) {
      return json({ error: `Missing/invalid fields: ${missing.join(", ")}` }, 400);
    }

    // —— userId: déduction depuis orderId si absent
    if (!userId) {
      console.log(`[render-slide] ⚠️ Missing userId, deducing from orderId=${orderId}`);
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("user_id")
        .eq("id", orderId)
        .single();

      if (orderErr || !order?.user_id) {
        console.error("[render-slide] ❌ Cannot deduce userId:", orderErr);
        return json({ error: "userId is required and could not be deduced from orderId" }, 400);
      }
      userId = order.user_id;
      console.log(`[render-slide] ✅ Deduced userId=${userId}`);
    }

    const lang = normalizeLang(language);
    const { ar: normalizedAR, size } = normalizeAspectRatio(aspectRatio);

    const logCtx = `order=${orderId} car=${carouselId} slide=${slideIndex + 1}/${totalSlides}`;
    console.log(`[render-slide] ${logCtx} context`, {
      userId,
      ar: normalizedAR,
      size,
      lang,
    });

    // ------------------------------------------
    // Normalize textual content + soft limits
    // ------------------------------------------
    const MAX_TITLE = 80;
    const MAX_SUB   = 160;
    const MAX_BUL   = 4;
    const MAX_BUL_LEN = 90;

    const normTitle = String(slideContent.title || "").trim().slice(0, MAX_TITLE);
    const normSubtitle = String(slideContent.subtitle || "").trim().slice(0, MAX_SUB);
    const normBullets = (Array.isArray(slideContent.bullets) ? slideContent.bullets : [])
      .map(b => String(b || "").trim())
      .filter(b => b.length > 0)
      .slice(0, MAX_BUL)
      .map(b => b.slice(0, MAX_BUL_LEN));

    if (!normTitle) {
      return json({ error: "slideContent.title cannot be empty after normalization" }, 400);
    }
    if (!slideContent.alt || !String(slideContent.alt).trim()) {
      return json({ error: "slideContent.alt is required" }, 400);
    }

    // =========================================
    // STEP 1/4 — Upload texte JSON (RAW)
    // =========================================
    console.log(`[render-slide] ${logCtx} 1/4 Upload text JSON → Cloudinary RAW`);
    const textPublicId = await uploadTextAsRaw(
      {
        title: normTitle,
        subtitle: normSubtitle,
        bullets: normBullets,
        alt: slideContent.alt,
      },
      {
        brandId,
        campaign,
        carouselId,
        textVersion,
        language: lang,
      }
    );
    console.log(`[render-slide] ${logCtx}   ↳ text_public_id: ${textPublicId}`);

    // =========================================
    // STEP 2/4 — Générer background (Vertex AI Gemini priorité)
    // =========================================
    
    // ✅ Prompt différent selon le mode
    const enrichedPrompt = carouselMode === 'premium'
      ? buildImagePromptPremium(
          prompt,     // ✅ Thème utilisateur
          brandKit,   // ✅ Brand Kit V2 complet
          useBrandKit,
          { title: normTitle, subtitle: normSubtitle, body: slideContent.body, bullets: normBullets, alt: slideContent.alt },
          slideIndex,
          totalSlides,
          lang,       // ✅ Langue pour le texte
          referenceImageUrl // ✅ Image de référence
        )
      : buildImagePromptStandard(
          globalStyle, 
          prompt, 
          useBrandKit,
          { title: normTitle, subtitle: normSubtitle, alt: slideContent.alt },
          slideIndex,
          totalSlides
        );
    
    console.log(`[render-slide] ${logCtx} 🎨 Mode: ${carouselMode}, hasText: ${!!normTitle && normTitle !== "Titre par défaut"}, hasRef: ${!!referenceImageUrl}`);

    let bgUrl: string | null = null;

    // ✅ PRIORITÉ 1: Vertex AI Gemini 2.5
    if (isVertexGeminiConfigured()) {
      const vertexModel = getVertexCarouselModel(carouselMode);
      console.log(`[render-slide] ${logCtx} 2/4 Trying Vertex AI Gemini ${vertexModel}...`);
      
      try {
        const vertexImage = await callVertexGeminiImage(enrichedPrompt, vertexModel);
        if (vertexImage) {
          bgUrl = vertexImage;
          console.log(`[render-slide] ${logCtx} ✅ Vertex AI Gemini succeeded`);
        } else {
          console.warn(`[render-slide] ${logCtx} ⚠️ Vertex AI Gemini returned no image`);
        }
      } catch (vertexErr) {
        console.error(`[render-slide] ${logCtx} ❌ Vertex AI Gemini error:`, vertexErr);
      }
    }

    // ✅ PRIORITÉ 2: Fallback Lovable AI
    if (!bgUrl) {
      const MODEL_IMAGE = carouselMode === 'premium' ? MODEL_IMAGE_PREMIUM : MODEL_IMAGE_STANDARD;
      console.log(`[render-slide] ${logCtx} 2/4 Fallback to Lovable AI (${MODEL_IMAGE})...`);
      
      const aiRes = await fetchWithRetries(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL_IMAGE,
            messages: [{ role: "user", content: enrichedPrompt }],
            modalities: ["image", "text"],
            size_hint: { width: size.w, height: size.h },
          }),
        },
        2
      );

      if (aiRes.status === 429) {
        console.error(`[render-slide] ${logCtx} ⏱️ Rate limit (429) after retries`);
        return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
      }
      if (aiRes.status === 402) {
        console.error(`[render-slide] ${logCtx} 💳 Insufficient credits (402)`);
        return json({ error: "Insufficient credits for AI generation" }, 402);
      }
      if (!aiRes.ok) {
        const errTxt = await aiRes.text().catch(() => "");
        console.error(`[render-slide] ${logCtx} ❌ AI error:`, aiRes.status, errTxt.slice(0, 600));
        return json({ error: `Background generation failed (${aiRes.status})` }, 502);
      }

      const aiData = await aiRes.json().catch(() => ({}));
      bgUrl =
        aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
        aiData?.choices?.[0]?.message?.content?.[0]?.image_url?.url ||
        aiData?.choices?.[0]?.message?.image_url?.url ||
        aiData?.image_url?.url ||
        null;
    }

    if (!bgUrl) {
      console.error(`[render-slide] ${logCtx} ❌ No background URL from any AI provider`);
      return json({ error: "AI did not return an image URL" }, 500);
    }
    console.log(`[render-slide] ${logCtx}   ↳ background_url: ${String(bgUrl).slice(0, 120)}`);

    // =========================================
    // STEP 3/4 — Upload image → Cloudinary (edge)
    // =========================================
    console.log(`[render-slide] ${logCtx} 3/4 Upload background → Cloudinary`);
    const slidePublicId = `slide_${String(slideIndex + 1).padStart(2, "0")}`;
    const slideFolder = `alfie/${brandId}/${carouselId}/slides`;

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.functions.invoke("cloudinary", {
      body: {
        action: "upload",
        params: {
          file: bgUrl,
          folder: slideFolder,
          public_id: slidePublicId,
          resource_type: "image",
          overwrite: true, // idempotence sur le même slide_public_id
          tags: [brandId, carouselId, "carousel_slide", campaign, "alfie"],
          context: {
            brand: brandId,
            carousel: carouselId,
            campaign: campaign,
            slide_index: String(slideIndex),
            render_version: String(renderVersion),
            text_version: String(textVersion),
            aspect_ratio: normalizedAR,
            size_hint: `${size.w}x${size.h}`,
          },
        },
      },
    });

    if (uploadErr || !uploadData) {
      console.error(`[render-slide] ${logCtx} ❌ Cloudinary upload error:`, uploadErr);
      return json({ error: `Failed to upload to Cloudinary: ${uploadErr?.message || "Unknown error"}` }, 502);
    }

    const cloudinarySecureUrl: string = uploadData.secure_url;
    const cloudinaryPublicId: string = uploadData.public_id;
    const uploadMeta = {
      width: uploadData.width,
      height: uploadData.height,
      format: uploadData.format,
    };

    console.log(`[render-slide] ${logCtx}   ↳ uploaded:`, {
      publicId: cloudinaryPublicId,
      url: cloudinarySecureUrl?.slice(0, 120),
      ...uploadMeta,
    });

    // =========================================
    // STEP 3.5 — Apply text overlay (STANDARD mode only)
    // =========================================
    let finalUrl = cloudinarySecureUrl;
    
    if (carouselMode === 'standard') {
      console.log(`[render-slide] ${logCtx} 3.5/4 Applying Cloudinary text overlay (Standard mode, type=${carouselType})`);
      
      // Déterminer le type de slide pour l'overlay
      const slideType = slideIndex === 0 ? 'hero' 
        : slideIndex === totalSlides - 1 ? 'cta'
        : slideIndex === 1 ? 'problem'
        : slideIndex === totalSlides - 2 ? 'solution'
        : 'impact';
      
      // ✅ Pour CITATIONS: forcer subtitle/bullets à vide, même si passés
      const slideData: Slide = {
        type: slideType,
        title: normTitle,
        subtitle: carouselType === 'citations' ? undefined : (normSubtitle || undefined),
        bullets: carouselType === 'citations' ? undefined : (normBullets.length > 0 ? normBullets : undefined),
        cta: slideType === 'cta' ? normTitle : undefined,
        author: slideContent.author || undefined, // ✅ Auteur pour les citations
      };
      
      // Couleurs pour l'overlay (blanc par défaut)
      const primaryColor = 'ffffff';
      const secondaryColor = 'cccccc';
      
      try {
        finalUrl = buildCarouselSlideUrl(
          cloudinaryPublicId,
          slideData,
          primaryColor,
          secondaryColor,
          carouselType // ✅ Passer le type de carrousel
        );
        console.log(`[render-slide] ${logCtx}   ↳ overlay URL: ${finalUrl?.slice(0, 150)}...`);
      } catch (overlayErr) {
        console.warn(`[render-slide] ${logCtx} ⚠️ Overlay failed, using base image:`, overlayErr);
        // En cas d'erreur, utiliser l'image de base
        finalUrl = cloudinarySecureUrl;
      }
    } else {
      // ✅ PREMIUM MODE: Le texte est INTÉGRÉ NATIVEMENT par Gemini 3 Pro
      // PAS d'overlay Cloudinary - l'image est déjà complète avec le texte
      console.log(`[render-slide] ${logCtx} 3.5/4 Premium mode: text integrated natively by Gemini 3 Pro (NO overlay)`);
      
      // L'URL finale est directement l'image générée par Gemini
      // Le texte a été intégré dans buildImagePromptPremium
      finalUrl = cloudinarySecureUrl;
      console.log(`[render-slide] ${logCtx}   ↳ Premium native URL: ${finalUrl?.slice(0, 150)}...`);
    }

    // =========================================
    // STEP 4/4 — Upsert DB (idempotent)
    // =========================================
    console.log(`[render-slide] ${logCtx} 4/4 Save to library_assets (idempotence check)`);
    const existingQuery = supabaseAdmin
      .from("library_assets")
      .select("id, cloudinary_url, cloudinary_public_id")
      .eq("order_id", orderId)
      .eq("carousel_id", carouselId)
      .eq("slide_index", slideIndex);

    if (orderItemId) {
      existingQuery.eq("order_item_id", orderItemId);
    } else {
      existingQuery.is("order_item_id", null);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      console.log(`[render-slide] ${logCtx} ♻️ Asset already exists: ${existing.id}`);
      return json({
        success: true,
        idempotent: true,
        cloudinary_url: existing.cloudinary_url,
        cloudinary_public_id: existing.cloudinary_public_id,
        text_public_id: textPublicId,
        slide_metadata: {
          title: normTitle,
          subtitle: normSubtitle,
          bullets: normBullets,
          slideIndex,
          renderVersion,
          textVersion,
          aspectRatio: normalizedAR,
          carouselMode,
        },
      });
    }

    const { error: insertErr } = await supabaseAdmin.from("library_assets").insert({
      user_id: userId,
      brand_id: brandId,
      order_id: orderId,
      order_item_id: orderItemId ?? null,
      carousel_id: carouselId,
      type: "carousel_slide",
      slide_index: slideIndex,
      format: normalizedAR,
      campaign,
      cloudinary_url: finalUrl,           // ✅ URL finale (avec ou sans overlay selon le mode)
      cloudinary_public_id: cloudinaryPublicId,
      text_json: {
        title: normTitle,
        subtitle: normSubtitle,
        body: slideContent.body || '',
        bullets: normBullets,
        alt: slideContent.alt,
        text_public_id: textPublicId,
        text_version: textVersion,
        render_version: renderVersion,
        carousel_mode: carouselMode,      // ✅ Enregistrer le mode utilisé
      },
      metadata: {
        ...uploadMeta,
        cloudinary_base_url: cloudinarySecureUrl,   // ✅ URL de base (sans overlay)
        cloudinary_overlay_url: carouselMode === 'standard' ? finalUrl : null, // ✅ URL avec overlay
        original_public_id: cloudinaryPublicId,
        totalSlides,
        aspectRatio: normalizedAR,
        size_hint: `${size.w}x${size.h}`,
        orderItemId: orderItemId ?? null,
        requestId,
        carouselMode,
      },
    });

    if (insertErr) {
      console.error(`[render-slide] ${logCtx} ❌ DB insert error:`, insertErr);
      return json({ error: `Failed to save slide: ${insertErr.message}` }, 500);
    }

    console.log(`[render-slide] ${logCtx} ✅ Slide saved (mode: ${carouselMode})`);
    return json({
      success: true,
      cloudinary_url: finalUrl,           // ✅ URL finale
      cloudinary_base_url: cloudinarySecureUrl, // ✅ URL de base
      cloudinary_public_id: cloudinaryPublicId,
      text_public_id: textPublicId,
      carousel_mode: carouselMode,
      slide_metadata: {
        title: normTitle,
        subtitle: normSubtitle,
        bullets: normBullets,
        slideIndex,
        totalSlides,
        renderVersion,
        textVersion,
        aspectRatio: normalizedAR,
        carouselMode,
      },
    });
  } catch (err: any) {
    console.error("[alfie-render-carousel-slide] 💥 Error:", err);
    return json(
      {
        error: err?.message || "Unknown error",
        details: err?.stack,
      },
      500
    );
  }
});
