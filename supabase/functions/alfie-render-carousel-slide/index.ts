// functions/alfie-render-carousel-slide/index.ts
// v2.3.0 — Slide renderer (idempotent, retries, clean outputs)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { uploadTextAsRaw } from "../_shared/cloudinaryUploader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Lang = "FR" | "EN";

interface SlideRequest {
  userId?: string; // ✅ Required or deduced from orderId
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
  carouselId: string;
  slideIndex: number;
  totalSlides: number;
  aspectRatio: string; // "4:5" / "1080x1350" etc.
  textVersion: number;
  renderVersion: number;
  campaign: string;
  language?: Lang | string;
}

type GenSize = { w: number; h: number };

const MODEL_IMAGE = "google/gemini-2.5-flash-image-preview";

const AR_MAP: Record<string, GenSize> = {
  "1:1": { w: 1024, h: 1024 },
  "4:5": { w: 1024, h: 1280 },
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
};

const PIXEL_TO_AR: Record<string, string> = {
  "1080x1350": "4:5",
  "1080x1920": "9:16",
  "1920x1080": "16:9",
  "1080x1080": "1:1",
};

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

function buildImagePrompt(globalStyle: string, prompt: string) {
  // “NO TEXT” blinders + qualité
  return `${globalStyle}. ${prompt}. 
Background only. No text, no typography, no letters, no logos, no watermark. 
Clean, professional, high quality, detailed, natural light, soft shadows.`;
}

async function fetchWithRetries(url: string, init: RequestInit, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, init);
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

serve(async (req) => {
  console.log("[alfie-render-carousel-slide] v2.3.0 — invoked");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const params = (await req.json()) as SlideRequest;
    let {
      userId,
      prompt,
      globalStyle,
      slideContent,
      brandId,
      orderId,
      carouselId,
      slideIndex,
      totalSlides,
      aspectRatio,
      textVersion,
      renderVersion,
      campaign,
      language = "FR",
    } = params;

    // —— Supabase admin client (service role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // —— Validations d’entrée minimales
    const missing: string[] = [];
    if (!prompt) missing.push("prompt");
    if (!globalStyle) missing.push("globalStyle");
    if (!slideContent?.title) missing.push("slideContent.title");
    if (!slideContent?.alt) missing.push("slideContent.alt");
    if (!brandId) missing.push("brandId");
    if (!orderId) missing.push("orderId");
    if (!carouselId) missing.push("carouselId");

    if (missing.length) {
      return json({ error: `Missing fields: ${missing.join(", ")}` }, 400);
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

    console.log("[render-slide] ▶️ Context", {
      userId,
      orderId,
      carouselId,
      idx: `${slideIndex + 1}/${totalSlides}`,
      ar: normalizedAR,
      size,
      lang,
    });

    // =========================================
    // STEP 1/4 — Upload texte JSON (RAW)
    // =========================================
    console.log("[render-slide] 1/4 Upload text JSON → Cloudinary RAW");
    const textPublicId = await uploadTextAsRaw(
      {
        title: slideContent.title,
        subtitle: slideContent.subtitle || "",
        bullets: slideContent.bullets || [],
        alt: slideContent.alt,
      },
      {
        brandId,
        campaign,
        carouselId,
        textVersion,
        language: lang,
      },
    );
    console.log("[render-slide]   ↳ text_public_id:", textPublicId);

    // =========================================
    // STEP 2/4 — Générer background (Lovable AI)
    // =========================================
    console.log("[render-slide] 2/4 Generate background via Lovable AI");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    const enrichedPrompt = buildImagePrompt(globalStyle, prompt);

    // NB: L’API Lovable chat+images peut retourner différentes formes.
    // On tente la voie “chat/completions” multi-modal, avec retries.
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
          // Indique l’intention image
          modalities: ["image", "text"],
          // (Optionnel) on peut passer des hints de taille si supportés par le modèle
          // size: `${size.w}x${size.h}`,
        }),
      },
      2,
    );

    if (aiRes.status === 429) {
      console.error("[render-slide] ⏱️ Rate limit (429) after retries");
      return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
    }
    if (aiRes.status === 402) {
      console.error("[render-slide] 💳 Insufficient credits (402)");
      return json({ error: "Insufficient credits for AI generation" }, 402);
    }
    if (!aiRes.ok) {
      const errTxt = await aiRes.text().catch(() => "");
      console.error("[render-slide] ❌ AI error:", aiRes.status, errTxt.slice(0, 600));
      return json({ error: `Background generation failed (${aiRes.status})` }, 502);
    }

    const aiData = await aiRes.json().catch(() => ({}));
    // Tenter divers chemins possibles pour l’URL d’image retournée
    const bgUrl =
      aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
      aiData?.choices?.[0]?.message?.content?.[0]?.image_url?.url ||
      aiData?.choices?.[0]?.message?.image_url?.url ||
      aiData?.image_url?.url ||
      null;

    if (!bgUrl) {
      console.error("[render-slide] ❌ No background URL in AI response:", JSON.stringify(aiData).slice(0, 1200));
      return json({ error: "AI did not return an image URL", details: aiData }, 500);
    }
    console.log("[render-slide]   ↳ background_url:", bgUrl.substring(0, 120));

    // =========================================
    // STEP 3/4 — Upload image → Cloudinary (fonction centralisée)
    // =========================================
    console.log("[render-slide] 3/4 Upload background → Cloudinary (edge function)");
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
          // overwrite true pour idempotence du même slide_public_id
          overwrite: true,
          tags: [brandId, carouselId, "carousel_slide", campaign, "alfie"],
          context: {
            brand: brandId,
            carousel: carouselId,
            campaign: campaign,
            slide_index: String(slideIndex),
            render_version: String(renderVersion),
            text_version: String(textVersion),
            aspect_ratio: normalizedAR,
          },
        },
      },
    });

    if (uploadErr || !uploadData) {
      console.error("[render-slide] ❌ Cloudinary upload error:", uploadErr);
      return json({ error: `Failed to upload to Cloudinary: ${uploadErr?.message || "Unknown error"}` }, 502);
    }

    const cloudinarySecureUrl: string = uploadData.secure_url;
    const cloudinaryPublicId: string = uploadData.public_id;
    const uploadMeta = {
      width: uploadData.width,
      height: uploadData.height,
      format: uploadData.format,
    };

    console.log("[render-slide]   ↳ uploaded:", {
      publicId: cloudinaryPublicId,
      url: cloudinarySecureUrl?.slice(0, 120),
      ...uploadMeta,
    });

    // =========================================
    // STEP 4/4 — Upsert DB (idempotent)
    // =========================================
    console.log("[render-slide] 4/4 Save to library_assets (idempotence check)");
    const { data: existing } = await supabaseAdmin
      .from("library_assets")
      .select("id, cloudinary_url, cloudinary_public_id")
      .eq("order_id", orderId)
      .eq("carousel_id", carouselId)
      .eq("slide_index", slideIndex)
      .maybeSingle();

    if (existing) {
      console.log(`[render-slide] ♻️ Asset already exists: ${existing.id}`);
      return json({
        success: true,
        idempotent: true,
        cloudinary_url: existing.cloudinary_url,
        cloudinary_public_id: existing.cloudinary_public_id,
        text_public_id: textPublicId,
        slide_metadata: {
          title: slideContent.title,
          subtitle: slideContent.subtitle || "",
          bullets: slideContent.bullets || [],
          slideIndex,
          renderVersion,
          textVersion,
          aspectRatio: normalizedAR,
        },
      });
    }

    const { error: insertErr } = await supabaseAdmin.from("library_assets").insert({
      user_id: userId,
      brand_id: brandId,
      order_id: orderId,
      carousel_id: carouselId,
      type: "carousel_slide",
      slide_index: slideIndex,
      format: normalizedAR,
      campaign,
      cloudinary_url: cloudinarySecureUrl, // URL complète pour affichage
      cloudinary_public_id: cloudinaryPublicId, // public_id pour transformations ultérieures
      text_json: {
        title: slideContent.title,
        subtitle: slideContent.subtitle || "",
        bullets: slideContent.bullets || [],
        alt: slideContent.alt,
        text_public_id: textPublicId,
        text_version: textVersion,
        render_version: renderVersion,
      },
      metadata: {
        ...uploadMeta,
        cloudinary_base_url: cloudinarySecureUrl,
        original_public_id: cloudinaryPublicId,
        totalSlides,
      },
    });

    if (insertErr) {
      console.error("[render-slide] ❌ DB insert error:", insertErr);
      return json({ error: `Failed to save slide: ${insertErr.message}` }, 500);
    }

    console.log("[render-slide] ✅ Slide saved:", { orderId, carouselId, slideIndex });

    return json({
      success: true,
      cloudinary_url: cloudinarySecureUrl,
      cloudinary_public_id: cloudinaryPublicId,
      text_public_id: textPublicId,
      slide_metadata: {
        title: slideContent.title,
        subtitle: slideContent.subtitle || "",
        bullets: slideContent.bullets || [],
        slideIndex,
        totalSlides,
        renderVersion,
        textVersion,
        aspectRatio: normalizedAR,
      },
    });
  } catch (err: any) {
    console.error("[alfie-render-carousel-slide] 💥 Error:", err);
    return json(
      {
        error: err?.message || "Unknown error",
        details: err?.stack,
      },
      500,
    );
  }
});
