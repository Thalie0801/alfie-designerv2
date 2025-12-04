// functions/alfie-render-carousel-slide/index.ts
// v2.6.0 — Slide renderer with Standard/Premium mode (text overlay vs native text)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { uploadTextAsRaw } from "../_shared/cloudinaryUploader.ts";
import { buildCarouselSlideUrl, Slide } from "../_shared/imageCompositor.ts";
import { getCarouselModel } from "../_shared/aiModels.ts";
import { 
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY, 
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY 
} from "../_shared/env.ts";

import { corsHeaders } from "../_shared/cors.ts";
type Lang = "FR" | "EN";

type CarouselMode = 'standard' | 'premium';

interface SlideRequest {
  userId?: string;               // ✅ Required or deduced from orderId
  prompt: string;
  globalStyle: string;
  slideContent: {
    title: string;
    subtitle?: string;
    bullets?: string[];
    alt: string;
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
  carouselMode?: CarouselMode;  // ✅ NOUVEAU: Standard (overlay) ou Premium (texte intégré)
}

type GenSize = { w: number; h: number };

const MODEL_IMAGE_STANDARD = "google/gemini-2.5-flash-image-preview";
const MODEL_IMAGE_PREMIUM = "google/gemini-3-pro-image-preview";

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
 * Build prompt for STANDARD mode (image only, no text - text added via Cloudinary overlay)
 */
function buildImagePromptStandard(
  globalStyle: string, 
  prompt: string, 
  useBrandKit: boolean,
  slideContent: { title: string; subtitle?: string; alt: string },
  slideIndex: number,
  totalSlides: number
): string {
  // Thème global de la campagne
  const globalTheme = prompt?.trim() || "Professional marketing";
  
  // Contexte spécifique de la slide basé sur sa position
  const slideRole = getSlideRole(slideIndex, totalSlides);
  
  // Contenu textuel de cette slide pour guider l'image
  const slideContext = slideContent.alt || slideContent.title;
  
  const styleHint = useBrandKit && globalStyle 
    ? globalStyle 
    : "Professional, modern, clean design";
  
  return `Generate ONE SINGLE scene illustration.

CAMPAIGN THEME: ${globalTheme}
SLIDE CONTEXT: This is a ${slideRole} slide. The text overlay will say: "${slideContext}"

COMPOSITION REQUIREMENTS:
- Create a visual that supports and reinforces the message: "${slideContent.title}"
- Include a clear focal point related to the slide's message
- Leave a clean area (solid color, soft gradient, or subtle texture) for text overlay
- The image should visually represent the concept of: ${slideContext}

VISUAL STYLE:
${styleHint}

STRICT PROHIBITIONS:
- NO text, NO typography, NO letters, NO numbers, NO words
- NO logos, NO watermarks, NO icons, NO UI elements
- NO seamless patterns, NO repeated motifs, NO wallpaper designs

OUTPUT: High quality background image suitable for text overlay.`;
}

/**
 * Build prompt for PREMIUM mode (image WITH text integrated by Gemini 3 Pro)
 * ✅ Simplifié : titre uniquement pour éviter les chevauchements
 */
function buildImagePromptPremium(
  globalStyle: string, 
  prompt: string, 
  useBrandKit: boolean,
  slideContent: { title: string; subtitle?: string; alt: string },
  slideIndex: number,
  totalSlides: number
): string {
  const globalTheme = prompt?.trim() || "Professional marketing";
  
  const styleHint = useBrandKit && globalStyle 
    ? globalStyle 
    : "Professional, modern, clean design";

  // ✅ Limiter le texte : titre UNIQUEMENT (max 60 caractères)
  const displayTitle = slideContent.title.length > 60 
    ? slideContent.title.substring(0, 60) + "..."
    : slideContent.title;
  
  return `Generate a visually striking carousel slide.

INTEGRATE THIS TEXT beautifully into the image:
"${displayTitle}"

The text must be:
- Clearly readable with high contrast
- Large and prominent (main focus)
- Professional typography
- Centered or strategically placed

THEME: ${globalTheme}
STYLE: ${styleHint}

Create ONE cohesive image where the text is an integral, beautiful part of the design.
NO extra text, NO subtitles, NO additional words.`;
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
    // STEP 2/4 — Générer background (Lovable AI)
    // =========================================
    console.log(`[render-slide] ${logCtx} 2/4 Generate ${carouselMode === 'premium' ? 'slide WITH text' : 'background'} via Lovable AI`);
    
    // ✅ Prompt différent selon le mode
    const enrichedPrompt = carouselMode === 'premium'
      ? buildImagePromptPremium(
          globalStyle, 
          prompt, 
          useBrandKit,
          { title: normTitle, subtitle: normSubtitle, alt: slideContent.alt },
          slideIndex,
          totalSlides
        )
      : buildImagePromptStandard(
          globalStyle, 
          prompt, 
          useBrandKit,
          { title: normTitle, subtitle: normSubtitle, alt: slideContent.alt },
          slideIndex,
          totalSlides
        );

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
          // hint de taille — ignoré si non supporté
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
    const bgUrl =
      aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
      aiData?.choices?.[0]?.message?.content?.[0]?.image_url?.url ||
      aiData?.choices?.[0]?.message?.image_url?.url ||
      aiData?.image_url?.url ||
      null;

    if (!bgUrl) {
      console.error(`[render-slide] ${logCtx} ❌ No background URL in AI response:`, JSON.stringify(aiData).slice(0, 1200));
      return json({ error: "AI did not return an image URL", details: aiData }, 500);
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
      console.log(`[render-slide] ${logCtx} 3.5/4 Applying Cloudinary text overlay (Standard mode)`);
      
      // Déterminer le type de slide pour l'overlay
      const slideType = slideIndex === 0 ? 'hero' 
        : slideIndex === totalSlides - 1 ? 'cta'
        : slideIndex === 1 ? 'problem'
        : slideIndex === totalSlides - 2 ? 'solution'
        : 'impact';
      
      const slideData: Slide = {
        type: slideType,
        title: normTitle,
        subtitle: normSubtitle || undefined,
        bullets: normBullets.length > 0 ? normBullets : undefined,
        cta: slideType === 'cta' ? normTitle : undefined,
      };
      
      // Couleurs pour l'overlay (blanc par défaut)
      const primaryColor = 'ffffff';
      const secondaryColor = 'cccccc';
      
      try {
        finalUrl = buildCarouselSlideUrl(
          cloudinaryPublicId,
          slideData,
          primaryColor,
          secondaryColor
        );
        console.log(`[render-slide] ${logCtx}   ↳ overlay URL: ${finalUrl?.slice(0, 150)}...`);
      } catch (overlayErr) {
        console.warn(`[render-slide] ${logCtx} ⚠️ Overlay failed, using base image:`, overlayErr);
        // En cas d'erreur, utiliser l'image de base
        finalUrl = cloudinarySecureUrl;
      }
    } else {
      console.log(`[render-slide] ${logCtx} 3.5/4 Skipping overlay (Premium mode - text already integrated)`);
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
