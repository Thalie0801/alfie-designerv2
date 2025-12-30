// supabase/functions/alfie-job-worker/index.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadFromUrlToCloudinary } from "../_shared/cloudinaryUploader.ts";
import { consumeBrandQuotas } from "../_shared/quota.ts";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_FN_SECRET } from "../_shared/env.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { LOVABLE_API_KEY } from "../_shared/env.ts";

type JobRow = {
  id: string;
  user_id: string;
  order_id: string;
  type: "generate_texts" | "render_images" | "render_carousels" | "generate_video" | "animate_image";
  status: "queued" | "processing" | "running" | "completed" | "failed";
  retry_count: number | null;
  max_retries: number | null;
  payload: any;
  error?: string | null;
};

// ✅ TYPE CAROUSEL SLIDE - Architecture "Carousel Plan First"
type CarouselSlide = {
  slide_number: number;
  title_on_image: string;    // Max 50 caractères, punchy
  subtitle?: string;         // ✅ Sous-titre explicatif (max 30 caractères)
  text_on_image: string;     // Max 150 caractères, corps du texte
  caption: string;           // Pour le post social (1-3 phrases)
  bullets?: string[];        // Points liste optionnels
  author?: string;           // Auteur pour citations
};

const supabaseAdmin = createClient(
  SUPABASE_URL ?? "https://itsjonazifiiikozengd.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

console.log("[alfie-job-worker] 🎯 BOOT PROJECT =", SUPABASE_URL?.includes("itsjon") ? "itsjonazifiiikozengd ✅" : SUPABASE_URL);
console.log("[alfie-job-worker] 🔧 Supabase client initialized", {
  url: SUPABASE_URL ?? "https://itsjonazifiiikozengd.supabase.co",
  hasKey: !!SUPABASE_SERVICE_ROLE_KEY
});

// ---------- Utils ----------
const ok = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (message: string, status = 500) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isHttp429(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /429|rate limit/i.test(msg);
}

function isHttp402(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /402|payment required|insufficient credits/i.test(msg);
}

function extractImageUrl(response: any): string | null {
  const candidates = [
    response?.image_urls?.[0],
    response?.image_url,
    response?.imageUrl,
    response?.data?.image_url,
    response?.data?.url,
    response?.url,
    response?.output?.[0],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("http")) {
      return candidate;
    }
  }

  console.error("[extractImageUrl] No valid URL found", { response });
  return null;
}

async function callFn<T = unknown>(name: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(`Missing Supabase configuration for ${name}`);
  }
  if (!INTERNAL_FN_SECRET) {
    throw new Error(`Missing INTERNAL_FN_SECRET for ${name}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "X-Internal-Secret": INTERNAL_FN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    const text = await resp.text().catch(() => "");
    if (!resp.ok) {
      throw new Error(`${name} failed: ${resp.status} ${resp.statusText} ${text}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  } catch (error: unknown) {
    const isAbort =
      (error as any)?.name === "AbortError" ||
      (error instanceof DOMException && error.name === "AbortError");
    if (isAbort) {
      throw new Error(`${name} timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapResult<T = unknown>(input: any): T {
  if (input && typeof input === "object" && "data" in input && (input as any).data != null) {
    return unwrapResult<T>((input as any).data);
  }
  return input as T;
}

function extractError(input: any): string | null {
  if (!input || typeof input !== "object") return null;
  if ("error" in input) {
    const value = (input as any).error;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if ("data" in input) {
    return extractError((input as any).data);
  }
  return null;
}

function getResultValue<T = unknown>(input: any, keys: string[]): T | null {
  for (const key of keys) {
    const value = deepGet(input, key);
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }
  return null;
}

function deepGet(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return null;
  if (key in obj && (obj as any)[key] != null) {
    return (obj as any)[key];
  }
  if ("data" in obj) {
    return deepGet((obj as any).data, key);
  }
  return null;
}

/**
 * Map visualStyle to prompt prefix
 */
function getStylePromptPrefix(visualStyle?: string): string {
  const styles: Record<string, string> = {
    'photorealistic': 'Photorealistic, ultra realistic, professional photography style',
    'cinematic_photorealistic': 'Cinematic photorealistic, movie still, dramatic lighting, film grain',
    '3d_pixar_style': '3D Pixar-inspired render, adorable cartoon style, soft lighting, clean shadows',
    'flat_illustration': 'Flat illustration style, vector-like, minimalist, clean lines, modern',
    'minimalist_vector': 'Minimalist vector design, simple shapes, clean, modern, professional',
    'digital_painting': 'Digital painting, artistic, painterly brush strokes, vibrant colors',
    'comic_book': 'Comic book style, bold outlines, pop art colors, dynamic composition',
  };
  return styles[visualStyle || 'photorealistic'] || styles['photorealistic'];
}

/**
 * Convertit un code hex en description de couleur lisible
 * Évite d'afficher des codes comme "#FF6B6B" sur les images
 */
function hexToColorName(hex: string): string {
  const h = hex.toLowerCase().replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  
  // Déterminer la couleur dominante
  if (r > 200 && g < 100 && b < 100) return 'vibrant red';
  if (r < 100 && g > 200 && b < 100) return 'fresh green';
  if (r < 100 && g < 100 && b > 200) return 'deep blue';
  if (r > 200 && g > 150 && b < 100) return 'warm orange';
  if (r > 200 && g > 200 && b < 100) return 'bright yellow';
  if (r > 200 && g < 100 && b > 150) return 'pink magenta';
  if (r > 150 && g < 100 && b > 200) return 'purple violet';
  if (r < 100 && g > 200 && b > 200) return 'turquoise cyan';
  if (r > 150 && g > 150 && b > 150) return 'light neutral';
  if (r < 80 && g < 80 && b < 80) return 'dark neutral';
  return 'neutral tone';
}

/**
 * ✅ Helper robuste pour résoudre useBrandKit sans faux-positifs
 */
function resolveUseBrandKit(payload: any, jobMeta?: { use_brand_kit?: boolean }): boolean {
  // Priorité 1 : payload.useBrandKit explicite (boolean)
  if (typeof payload?.useBrandKit === "boolean") {
    return payload.useBrandKit;
  }
  // Priorité 2 : jobMeta.use_brand_kit
  if (typeof jobMeta?.use_brand_kit === "boolean") {
    return jobMeta.use_brand_kit;
  }
  // Default : true (seulement si RIEN n'est spécifié)
  return true;
}

/**
 * Extrait le CONTENU (thème/sujet) du payload pour images/carousels
 * Le thème utilisateur doit TOUJOURS être préservé
 */
function buildContentPrompt(payload: any): string {
  const sources = [
    payload.prompt,
    payload.brief?.topic,
    payload.brief?.content,
    payload.brief?.full,
    payload.topic,
    payload.campaign,
    payload.brief?.objective,
  ];
  
  const content = sources.find(s => s && typeof s === 'string' && s.trim().length > 0);
  
  if (!content) {
    console.warn("[buildContentPrompt] ⚠️ No user content found in payload");
    return "Professional marketing visual";
  }
  
  return content.trim();
}

/**
 * Construit un prompt vidéo avec support OPTIONNEL de texte intégré
 * ✅ V3: Supporte l'affichage de texte (hook/cta) directement via Veo 3.1
 */
function buildVideoPrompt(
  payload: any, 
  useBrandKit: boolean, 
  brand?: any,
  textOverlay?: { hook?: string; cta?: string; } // ✅ NEW: Textes à afficher sur la vidéo
): string {
  console.log("[buildVideoPrompt] 🎬 Input:", { 
    prompt: payload.prompt?.slice(0, 50), 
    topic: payload.brief?.topic?.slice(0, 50),
    campaign: payload.campaign?.slice(0, 50),
    useBrandKit, 
    brandNiche: brand?.niche,
    brandPalette: brand?.palette?.slice(0, 2),
    hasTextOverlay: !!(textOverlay?.hook || textOverlay?.cta),
  });
  
  // ✅ PRIORITÉ 1 : Le prompt direct de l'utilisateur (description visuelle pure)
  let visualPrompt = payload.prompt || "";
  
  // ✅ PRIORITÉ 2 : Utiliser le brief si pas de prompt direct
  if (!visualPrompt.trim()) {
    visualPrompt = payload.brief?.topic || payload.campaign || "";
  }
  
  // ✅ Nettoyer les références au texte (regex éprouvées)
  visualPrompt = visualPrompt
    .replace(/texte\s*(anim|:\s*)/gi, '')
    .replace(/bouton\s*cta/gi, '')
    .replace(/"[^"]*"/g, '') // Retirer textes entre guillemets
    .replace(/\s+/g, ' ')
    .trim();
  
  // ✅ FALLBACK visuel si le prompt est vide ou trop court
  if (!visualPrompt || visualPrompt.length < 10) {
    visualPrompt = "Abstract flowing shapes with smooth motion, dynamic energy, professional atmosphere";
    console.log("[buildVideoPrompt] ⚠️ Using visual fallback - original prompt was too short");
  }
  
  // ✅ Style visuel basé sur les COULEURS de la marque (PAS le niche littéral!)
  let colorStyle = "";
  if (useBrandKit && brand?.palette?.length) {
    const colorNames = brand.palette.slice(0, 2).map(hexToColorName);
    colorStyle = `Color palette: ${colorNames.join(" and ")} tones. `;
    console.log("[buildVideoPrompt] 🎨 Brand colors applied:", colorNames);
  }
  
  // ✅ Instructions de texte: soit afficher le hook/cta, soit interdire tout texte
  let textInstructions = "";
  if (textOverlay?.hook || textOverlay?.cta) {
    const textParts: string[] = [];
    if (textOverlay.hook) {
      textParts.push(`Opening animated text appearing in first 2 seconds: "${textOverlay.hook}"`);
    }
    if (textOverlay.cta) {
      textParts.push(`Closing animated text appearing in last 2 seconds: "${textOverlay.cta}"`);
    }
    textInstructions = `TEXT TO DISPLAY ON VIDEO: ${textParts.join('. ')}. Use white bold text with elegant animation and subtle shadow for readability.`;
    console.log("[buildVideoPrompt] 📝 Text overlay requested:", { hook: textOverlay.hook?.slice(0, 30), cta: textOverlay.cta?.slice(0, 30) });
  } else {
    textInstructions = "NO TEXT, NO LETTERS, NO WORDS visible on screen.";
  }
  
  // ✅ Prompt final cinématique
  const finalPrompt = `${colorStyle}${visualPrompt}. Cinematic quality, smooth camera movement, professional lighting. ${textInstructions}`;
  
  console.log("[buildVideoPrompt] ✅ Final prompt:", finalPrompt.slice(0, 200) + "...");
  return finalPrompt;
}

/**
 * Construit le suffixe de STYLE selon useBrandKit et visualStyle
 * Le style est AJOUTÉ au contenu, jamais substitué
 */
function buildStyleSuffix(
  useBrandKit: boolean, 
  brand?: { niche?: string; palette?: string[]; voice?: string; name?: string },
  visualStyle?: string
): string {
  // Get style prefix based on visualStyle
  const stylePrefix = getStylePromptPrefix(visualStyle);
  
  if (useBrandKit && brand) {
    const parts = [stylePrefix];
    if (brand.niche) parts.push(`Industry: ${brand.niche}`);
    if (brand.palette?.length) {
      // ✅ Convertir hex en descriptions de couleurs
      const colorNames = brand.palette.slice(0, 3).map(hexToColorName);
      parts.push(`Color palette with ${colorNames.join(", ")}`);
    }
    if (brand.voice) parts.push(`Tone: ${brand.voice}`);
    return parts.join(". ") + ". High quality, professional.";
  }
  
  return `${stylePrefix}. Professional, modern, clean design with neutral color palette. High quality.`;
}

/**
 * Combine contenu utilisateur + style pour le prompt final
 * Ajoute des instructions logo si useLogo=true et brand.logo_url existe
 */
function buildFinalPrompt(payload: any, useBrandKit: boolean, brand?: any, visualStyle?: string, useLogo?: boolean): string {
  const content = buildContentPrompt(payload);
  const style = buildStyleSuffix(useBrandKit, brand, visualStyle);
  
  let prompt = `${content}. ${style}`;
  
  // ✅ NEW: Add logo integration instructions if enabled
  if (useLogo && brand?.logo_url) {
    prompt += ` Include subtle brand logo placement or leave space for logo overlay in composition. The logo should be integrated naturally without dominating the visual.`;
  }
  
  return prompt;
}

// ---------- HTTP Entrypoint ----------
Deno.serve(async (req) => {
  console.log("[alfie-job-worker] 🚀 Invoked at", new Date().toISOString());
  console.log("[job-worker] start");
  
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("🚀 [Worker] Starting job processing...");

    // Diagnostic détaillé de la configuration
    console.log("🧪 [Worker] Environment check", {
      SUPABASE_URL: SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      hasInternalSecret: !!INTERNAL_FN_SECRET,
      envVars: {
        ALFIE_SUPABASE_URL: !!Deno.env.get("ALFIE_SUPABASE_URL"),
        SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
        ALFIE_SERVICE_KEY: !!Deno.env.get("ALFIE_SUPABASE_SERVICE_ROLE_KEY"),
        SERVICE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      }
    });

    // Process a small batch to avoid function timeout
    const results: Array<{ job_id: string; success: boolean; error?: string; retried?: boolean }> = [];
    const maxJobs = 5;
    let processed = 0;

    for (let i = 0; i < maxJobs; i++) {
      // On prend simplement le premier job en file, sans supposer qu'il existe une colonne "created_at"
      const { data: job, error: fetchError } = await supabaseAdmin
        .from("job_queue")
        .select("*")
        .eq("status", "queued")
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error("❌ job_queue select failed", fetchError);
        break;
      }

      if (!job) {
        console.log(`ℹ️ No more jobs to process (processed ${processed})`);
        console.log("[job-worker] no job claimed");
        break;
      }

      const startedAt = new Date().toISOString();
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("job_queue")
        .update({ status: "running", started_at: startedAt, updated_at: startedAt })
        .eq("id", job.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.error("❌ failed to mark job as processing", { jobId: job.id, claimError });
        continue;
      }

      const jobIdPrefix = job.id.substring(0, 8);
      console.log(`[job-worker] claimed job ${job.id} type=${job.type}`);
      console.log("🟢 start_job", { id: `${jobIdPrefix}...`, type: job.type });
      console.log("[alfie-job-worker] Processing job", {
        jobId: job.id,
        type: job.type,
        orderId: job.order_id,
        userId: job.user_id,
      });

      try {
        let result: any;

        switch (job.type) {
          case "generate_texts":
            result = await processGenerateTexts(job.payload);
            break;
          case "render_images":
            // ✅ on passe aussi user_id / order_id / useBrandKit pour réparer les payloads legacy
            result = await processRenderImages(job.payload, {
              user_id: job.user_id,
              order_id: job.order_id,
              job_id: job.id,
              use_brand_kit: job.payload?.useBrandKit ?? true, // ✅ Extraction de useBrandKit
            });
            break;
          case "render_carousels":
            result = await processRenderCarousels(job.payload, {
              user_id: job.user_id,
              order_id: job.order_id,
              job_id: job.id,
              use_brand_kit: job.payload?.useBrandKit ?? true, // ✅ Extraction de useBrandKit
            });
            break;
          case "generate_video":
            result = await processGenerateVideo(job.payload, {
              user_id: job.user_id,
              order_id: job.order_id,
              job_id: job.id,
              use_brand_kit: job.payload?.useBrandKit ?? true, // ✅ Extraction de useBrandKit
            });
            break;
          default:
            console.warn("⚠️ unknown job type", job.type);
            result = null;
            break;
        }

        const finishedAt = new Date().toISOString();
        const { error: completeError } = await supabaseAdmin
          .from("job_queue")
          .update({
            status: "completed",
            result,
            updated_at: finishedAt,
            finished_at: finishedAt,
          })
          .eq("id", job.id);

        if (completeError) {
        console.error("❌ failed to mark job completed", { jobId: job.id, error: completeError });
          await supabaseAdmin
            .from("job_queue")
            .update({
              status: "failed",
              error: `complete update failed: ${completeError.message}`,
              updated_at: finishedAt,
              finished_at: finishedAt,
            })
            .eq("id", job.id);
          results.push({ job_id: job.id, success: false, error: completeError.message });
          continue;
        }

        // 🔹 Mettre à jour l'ordre si présent
        if (job.order_id) {
          const { error: orderUpdateError } = await supabaseAdmin
            .from("orders")
            .update({ status: "completed", updated_at: finishedAt })
            .eq("id", job.order_id);
          
          if (orderUpdateError) {
            console.warn("[alfie-job-worker] ⚠️ Failed to update order status", {
              orderId: job.order_id,
              error: orderUpdateError
            });
          } else {
            console.log("[alfie-job-worker] ✅ Order marked as completed", {
              orderId: job.order_id
            });
          }
        }

        console.log("✅ job_done", { id: job.id, type: job.type });
        results.push({ job_id: job.id, success: true });

        const { data: remainingJobs } = await supabaseAdmin
          .from("job_queue")
          .select("id")
          .eq("status", "queued")
          .limit(1);

        if (remainingJobs && remainingJobs.length > 0) {
          console.log("[alfie-job-worker] 🔁 Remaining jobs detected, reinvoking...");
          try {
            const { error: invokeError } = await supabaseAdmin.functions.invoke("alfie-job-worker", {
              body: { trigger: "self-reinvoke" },
            });
            if (invokeError) {
              console.error("[alfie-job-worker] ⚠️ Reinvoke failed:", invokeError);
            }
          } catch (e) {
            console.error("[alfie-job-worker] ⚠️ Reinvoke error:", e);
          }
        }

        if (job.type === "generate_texts") {
          await createCascadeJobs(job, result, supabaseAdmin);
        }
      } catch (e) {
        console.error("❌ job_failed", { jobId: job.id, error: e });

        const failedAt = new Date().toISOString();
        await supabaseAdmin
          .from("job_queue")
          .update({
            status: "failed",
            error: e instanceof Error ? e.message : String(e),
            updated_at: failedAt,
            finished_at: failedAt,
          })
          .eq("id", job.id);

        // 🔹 Mettre à jour l'ordre en "failed" aussi
        if (job.order_id) {
          await supabaseAdmin
            .from("orders")
            .update({ status: "failed", updated_at: failedAt })
            .eq("id", job.order_id);
          
          console.log("[alfie-job-worker] ❌ Order marked as failed", {
            orderId: job.order_id
          });
        }

        const message = e instanceof Error ? e.message : "Unknown error";
        results.push({ job_id: job.id, success: false, retried: false, error: message });
        console.error("🔴 job_failed", { id: job.id, message });

        const retryCount = job.retry_count ?? 0;
        const maxRetries = job.max_retries ?? 3;
        const shouldRetry = retryCount < maxRetries && !isHttp402(e);

        if (shouldRetry) {
          await supabaseAdmin
            .from("job_queue")
            .update({
              status: "queued",
              retry_count: retryCount + 1,
              error: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          console.log(`🔄 requeued ${job.id} (${retryCount + 1}/${maxRetries})`);
          results.push({ job_id: job.id, success: false, retried: true, error: message });
        }
      }

      processed++;
    }

    return ok({ success: true, processed, results });
  } catch (e) {
    console.error("❌ [Worker] Fatal", e);
    return err(e instanceof Error ? e.message : "Unknown error");
  }
});

// ========================================
// ✅ GÉNÉRATION DU PLAN CAROUSEL (Gemini 3 Pro)
// Architecture "Carousel Plan First"
// ========================================
async function generateCarouselPlan(
  topic: string,
  slideCount: number,
  brandKit: any | null,
  useBrandKit: boolean,
  language: string = "FR"
): Promise<CarouselSlide[]> {
  console.log(`[generateCarouselPlan] 🎯 Generating ${slideCount} slides for topic: "${topic.slice(0, 50)}..."`);
  
  if (!LOVABLE_API_KEY) {
    console.error("[generateCarouselPlan] ❌ LOVABLE_API_KEY missing");
    return generateFallbackSlides(topic, slideCount, language);
  }
  
  // Contexte de marque (optionnel)
  const brandContext = useBrandKit && brandKit
    ? `Brand context: ${brandKit.name || 'Brand'}, niche: ${brandKit.niche || 'business'}, tone: ${brandKit.voice || 'professional'}.`
    : 'Generic professional tone.';
  
  const systemPrompt = `You are an expert social media content creator specializing in Instagram carousels.
Your goal is to create engaging, swipeable carousel content that keeps users reading.

CRITICAL RULES:
- title_on_image: MAX 5 WORDS, punchy, attention-grabbing
- text_on_image: MAX 20 WORDS, 2-3 very short lines for mobile readability
- caption: 1-3 sentences for the post caption (not displayed on image)
- NEVER include structural labels like "Hook", "CTA", "Problem", "Solution"
- NEVER include slide numbers in the text
- Return ONLY valid JSON, no markdown formatting`;

  const userPrompt = `Create a ${slideCount}-slide Instagram carousel.

Topic: "${topic}"

${brandContext}
Language: ${language === "EN" ? "English" : "French"}

Requirements:
- Exactly ${slideCount} slides
- First slide: Hook that grabs attention
- Middle slides: Key insights/points (one idea per slide)
- Last slide: Clear call-to-action

Return ONLY this JSON structure (no markdown, no explanation):
{
  "slides": [
    {
      "slide_number": 1,
      "title_on_image": "...",
      "text_on_image": "...",
      "caption": "..."
    }
  ]
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[generateCarouselPlan] ❌ API error: ${response.status} - ${errText.slice(0, 200)}`);
      return generateFallbackSlides(topic, slideCount, language);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    
    // Parser le JSON (gérer le markdown ```json...```)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const parsed = JSON.parse(jsonStr.trim());
    const slidesArray = parsed?.slides;
    
    if (!Array.isArray(slidesArray) || slidesArray.length === 0) {
      console.warn("[generateCarouselPlan] ⚠️ Invalid slides array, using fallback");
      return generateFallbackSlides(topic, slideCount, language);
    }
    
    // Normaliser et valider chaque slide
    const normalizedSlides: CarouselSlide[] = Array.from({ length: slideCount }, (_, i) => {
      const found = slidesArray.find((s: any) => s.slide_number === i + 1) || slidesArray[i];
      return {
        slide_number: i + 1,
        title_on_image: found?.title_on_image?.slice(0, 50) || `Slide ${i + 1}`,
        text_on_image: found?.text_on_image?.slice(0, 100) || "",
        caption: found?.caption?.slice(0, 300) || "",
      };
    });
    
    // Forcer un CTA sur la dernière slide si vide
    const lastIdx = normalizedSlides.length - 1;
    if (!normalizedSlides[lastIdx].title_on_image || normalizedSlides[lastIdx].title_on_image === `Slide ${slideCount}`) {
      normalizedSlides[lastIdx].title_on_image = language === "EN" ? "Learn More" : "En savoir plus";
    }
    
    console.log(`[generateCarouselPlan] ✅ Generated ${normalizedSlides.length} slides successfully`);
    normalizedSlides.forEach((s, i) => {
      console.log(`  Slide ${i + 1}: "${s.title_on_image}" | "${s.text_on_image.slice(0, 30)}..."`);
    });
    
    return normalizedSlides;
  } catch (error) {
    console.error("[generateCarouselPlan] ❌ Error:", error);
    return generateFallbackSlides(topic, slideCount, language);
  }
}

/**
 * Génère des slides de fallback basées sur le topic utilisateur
 */
function generateFallbackSlides(topic: string, count: number, language: string = "FR"): CarouselSlide[] {
  console.log(`[generateFallbackSlides] Generating ${count} DIFFERENTIATED fallback slides for: "${topic.slice(0, 30)}..."`);
  
  const isFR = language !== "EN";
  const topicClean = topic.slice(0, 50);
  
  // ✅ Titres DIFFÉRENCIÉS pour chaque slide intermédiaire
  const defaultTitles = isFR 
    ? ["Le problème", "La solution", "Les avantages", "Comment ça marche", "Ce qui change"]
    : ["The problem", "The solution", "Key benefits", "How it works", "What changes"];
  
  const defaultBodies = isFR
    ? ["Découvrez ce défi courant...", "Voici notre approche...", "Ce que vous obtenez...", "Simple et efficace...", "Faites le premier pas..."]
    : ["Discover this common challenge...", "Here's our approach...", "What you get...", "Simple and effective...", "Take the first step..."];
  
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      // Première slide: titre = topic
      return {
        slide_number: 1,
        title_on_image: topicClean,
        text_on_image: isFR ? "Découvrez comment..." : "Discover how...",
        caption: topic,
      };
    } else if (i === count - 1) {
      // Dernière slide: CTA
      return {
        slide_number: i + 1,
        title_on_image: isFR ? "Passez à l'action" : "Take Action",
        text_on_image: isFR ? "Prêt à commencer ?" : "Ready to start?",
        caption: isFR ? "Passez à l'action maintenant !" : "Take action now!",
      };
    } else {
      // ✅ Slides intermédiaires: titres UNIQUES par position
      const titleIndex = Math.min(i - 1, defaultTitles.length - 1);
      return {
        slide_number: i + 1,
        title_on_image: defaultTitles[titleIndex],
        text_on_image: defaultBodies[titleIndex],
        caption: "",
      };
    }
  });
}

// ========== JOB PROCESSORS ==========

async function processGenerateTexts(payload: any) {
  console.log("📝 [processGenerateTexts]");

  const { brief, brandKit, count = 1, type } = payload;
  const apiKey = LOVABLE_API_KEY || Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const systemPrompt =
    type === "image"
      ? "Tu es expert social media. Génère des variations de texte (headline ≤30, body ≤125, cta ≤20, alt ≤100). Réponds en JSON."
      : "Tu es expert storytelling carrousel. Génère un plan structuré de carousel. Réponds en JSON.";

  const userPrompt = `Brief: ${JSON.stringify(brief)}\nBrand Kit: ${JSON.stringify(brandKit)}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Lovable AI error: ${r.status} - ${t}`);
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";

  return { texts: content, count, type };
}

async function processRenderImage(payload: any) {
  console.log("🖼️ [processRenderImage]", payload?.orderId);

  const { userId, brandId, orderId, prompt, sourceUrl } = payload || {};
  if (!userId || !brandId || !orderId || !prompt) {
    throw new Error("Invalid render_image payload");
  }

  const resp = await callFn<any>("alfie-render-image", {
    prompt,
    brand_id: brandId,
    sourceUrl,
    userId,
    orderId,
    useBrandKit: payload.useBrandKit ?? true, // ✅ Propagation de useBrandKit
  });
  const data = resp as any;
  const error = data && data.error ? { message: data.error } : null;

  if (error || (data as any)?.error) {
    const message = (data as any)?.error || error?.message || "render_image_failed";
    throw new Error(message);
  }

  const imageUrl = (data as any)?.imageUrl || (data as any)?.data?.url || (data as any)?.url;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("Missing imageUrl");
  }

  // ⚠️ SECURITY: NEVER store base64 URLs in database (saturation prevention)
  if (imageUrl.startsWith('data:')) {
    console.error('[alfie-job-worker] 🚨 BLOCKED: base64 URL forbidden in database');
    throw new Error('SECURITY: base64 URLs are forbidden. Use Cloudinary URLs only.');
  }

  // ✅ alfie-render-image handles ALL database insertions (media_generations + library_assets)
  // DO NOT duplicate inserts here - this was causing 2 images per 1 woof consumed

  return { imageUrl };
}


async function processRenderImages(
  payload: any,
  jobMeta?: { user_id?: string | null; order_id?: string | null; job_id?: string | null; use_brand_kit?: boolean },
) {
  const jobUserId = jobMeta?.user_id ?? null;
  const jobOrderId = jobMeta?.order_id ?? null;
  const jobId = jobMeta?.job_id ?? null;

  console.log("[processRenderImages] start", {
    orderId: payload?.orderId ?? jobOrderId,
    brandId: payload?.brandId,
    jobId,
  });
  console.log("🖼️ [processRenderImages] payload.in", payload);

  // ✅ Cas 1 : ancien format "direct" (prompt simple sans brief/images)
  if (
    payload &&
    typeof payload.prompt === "string" &&
    payload.prompt.trim().length > 0 &&
    !payload.images &&
    !payload.brief
  ) {
    // on injecte userId / orderId provenant du job si manquants
    return processRenderImage({
      ...payload,
      userId: payload.userId ?? jobUserId,
      orderId: payload.orderId ?? jobOrderId,
    });
  }

  // ✅ Normalisation : on force userId / orderId à partir du job si absents
  if (!payload.userId && jobUserId) {
    payload.userId = jobUserId;
  }
  if (!payload.orderId && jobOrderId) {
    payload.orderId = jobOrderId;
  }

  // On reconstruit aussi brandId à partir de l’ordre si possible
  if (!payload.brandId && payload.orderId) {
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("brand_id")
      .eq("id", payload.orderId)
      .maybeSingle();

    if (orderErr) {
      console.error("[processRenderImages] order lookup failed", orderErr);
    }
    if (orderRow?.brand_id) {
      payload.brandId = orderRow.brand_id as string;
    }
  }

  if (!payload?.userId || !payload?.orderId) {
    console.error("[processRenderImages] legacy payload without userId/orderId", {
      jobUserId,
      jobOrderId,
      rawPayload: payload,
    });
    throw new Error("legacy payload without userId/orderId");
  }

  const userId = payload.userId as string;
  const orderId = payload.orderId as string;
  const brandId = (payload.brandId as string | undefined) || undefined;
  
  // ✅ Résoudre useBrandKit et useLogo une seule fois pour toute la fonction
  const useBrandKit = resolveUseBrandKit(payload, jobMeta);
  const useLogo = payload?.useLogo === true; // ✅ NEW: Résoudre useLogo

  const payloadEmail =
    typeof payload?.userEmail === "string" ? payload.userEmail.toLowerCase() : null;
  let resolvedUserEmail = payloadEmail;

  if (!resolvedUserEmail) {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    if (authError) {
      console.error("[job-worker] failed to resolve user email", authError);
    }
    resolvedUserEmail = authUser?.user?.email?.toLowerCase() ?? null;
  }

  const results: Array<{ url: string; aspectRatio: string; resolution: string; slideIndex?: number | null }> = [];
  const AR_MAP: Record<string, { w: number; h: number }> = {
    "1:1": { w: 1024, h: 1024 },
    "4:5": { w: 1080, h: 1350 },
    "9:16": { w: 1080, h: 1920 },
    "16:9": { w: 1920, h: 1080 },
    "2:3": { w: 1080, h: 1620 },
    "yt-thumb": { w: 1280, h: 720 },
  };

  const resolvedKind = (
    payload.kind ??
    payload.format ??
    (payload.type === "render_carousels"
      ? "carousel"
      : payload.type === "render_images"
        ? "image"
        : null)
  ) as "image" | "carousel" | null;
  const ratioFromPayload =
    payload.ratio ?? payload.aspectRatio ?? payload?.brief?.ratio ?? payload?.brief?.format?.split?.(" ")?.[0] ?? "4:5";
  const briefText =
    typeof payload?.brief === "string"
      ? payload.brief
      : payload?.topic ?? payload?.brief?.content ?? payload?.brief?.objective ?? "";
  const imagesCount = Math.max(1, Number(payload?.count ?? payload?.images?.length ?? payload?.brief?.numSlides ?? 1));
  
  // Générer carousel_id si carrousel et non fourni
  const carousel_id = resolvedKind === "carousel" 
    ? (payload.carousel_id || `carousel_${Date.now()}_${Math.random().toString(36).substring(7)}`)
    : undefined;

  let imagesToRender: Array<{
    prompt: string;
    resolution: string;
    aspectRatio: "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "yt-thumb";  // ✅ Ajout 2:3 Pinterest
    brandId?: string;
    briefIndex?: number;
    templateImageUrl?: string;
    slideIndex?: number;
    visualStyleCategory?: string;
  }> = [];

  if (payload.images) {
    imagesToRender = payload.images;
  } else if (resolvedKind && typeof payload.count === "number") {
    const ratioToUse = ratioFromPayload || "4:5";
    const { w, h } = AR_MAP[ratioToUse] || AR_MAP["4:5"];
    
    // ✅ Utiliser buildFinalPrompt avec visualStyleCategory pour préserver le thème
    const brandMini = useBrandKit ? await loadBrandMini(brandId, false) : undefined;
    const visualStyle = payload.visualStyle || "photorealistic";
    const visualStyleCategory = payload.visualStyleCategory || 'background'; // ✅ NEW
    const basePrompt = buildFinalPrompt(payload, useBrandKit, brandMini, visualStyle, useLogo); // ✅ Pass useLogo

    imagesToRender = Array.from({ length: imagesCount }).map((_, index) => ({
      prompt: `${basePrompt}. ${resolvedKind === "carousel" ? `Social media post ${index + 1} of ${imagesCount}.` : ""} Format ${ratioToUse}.`,
      resolution: `${w}x${h}`,
      aspectRatio: (ratioToUse as "1:1" | "4:5" | "9:16" | "16:9" | "yt-thumb") ?? "4:5",
      brandId: brandId ?? undefined,
      slideIndex: resolvedKind === "carousel" ? index : undefined,
      visualStyleCategory, // ✅ NEW: Propager le style visuel
    }));
  } else if (payload.brief) {
    const { briefs } = payload.brief;
    const brandIdLocal = payload.brandId;

    const { data: brand } = await supabaseAdmin
      .from("brands")
      .select("name, palette, voice, niche")
      .eq("id", brandIdLocal)
      .single();

    const visualStyle = payload.visualStyle || "photorealistic";
    const stylePrefix = getStylePromptPrefix(visualStyle);

    imagesToRender = (briefs || [payload.brief]).map((brief: any, i: number) => {
      const aspectRatio = brief?.ratio || payload.aspectRatio || "1:1";
      const { w, h } = AR_MAP[aspectRatio] || AR_MAP["1:1"];
      
      // ✅ Extraire le contenu du brief (thème utilisateur)
      const userContent = brief?.content || brief?.topic || payload.prompt || "Marketing visual";
      
      const prompt = useBrandKit && brand
        ? `${stylePrefix}. ${userContent}. Context: ${brief?.objective || "social media"}. Brand: ${brand?.niche || ""}, tone: ${brand?.voice || "professional"}.`
        : `${stylePrefix}. ${userContent}. Context: ${brief?.objective || "social media"}. Professional, modern design.`;

      return {
        prompt,
        resolution: `${w}x${h}`,
        aspectRatio: aspectRatio as any,
        brandId: brandIdLocal,
        briefIndex: i,
      };
    });
  } else {
    throw new Error("Invalid payload: missing images or brief");
  }

  console.log(`🖼️ [processRenderImages] total=${imagesToRender.length}`);

  for (const img of imagesToRender) {
    const aspectRatio = img.aspectRatio || "4:5";
    const slideIndex = typeof img.slideIndex === "number" ? img.slideIndex : img.briefIndex ?? null;
    const assetType = resolvedKind === "carousel" ? "carousel_slide" : "image";
    
    // Enrichir le prompt avec les textes générés si disponibles
    let enrichedPrompt = img.prompt;
    if (payload.generatedTexts && resolvedKind === "carousel" && typeof slideIndex === "number") {
      const slideTexts = payload.generatedTexts.slides?.[slideIndex];
      if (slideTexts) {
        enrichedPrompt = `${img.prompt}

TEXTE À INTÉGRER :
Titre : "${slideTexts.title}"
${slideTexts.subtitle ? `Sous-titre : "${slideTexts.subtitle}"` : ""}
${slideTexts.bullets ? slideTexts.bullets.map((b: string) => `• ${b}`).join("\n") : ""}`;
      }
    } else if (payload.generatedTexts?.text && resolvedKind === "image") {
      const imageTexts = payload.generatedTexts.text;
      enrichedPrompt = `${img.prompt}

TEXTE À INTÉGRER :
Titre : "${imageTexts.title}"
${imageTexts.body ? `Texte : "${imageTexts.body}"` : ""}
${imageTexts.cta ? `CTA : "${imageTexts.cta}"` : ""}`;
    }

    // ✅ Construire overlayText formaté pour Gemini 3 Pro (intégration native)
    let overlayText: string | null = null;
    if (payload.generatedTexts?.text && resolvedKind === "image") {
      const t = payload.generatedTexts.text;
      overlayText = [t.title, t.body, t.cta].filter(Boolean).join("\n");
      console.log("[processRenderImages] overlayText construit:", overlayText?.slice(0, 80));
    }

    try {
      // 1) generate
      // ✅ Log diagnostic pour tracer referenceImageUrl
      const sourceImageUrl = payload.referenceImageUrl ?? payload.sourceUrl ?? null;
      console.log("[processRenderImages] referenceImageUrl check:", {
        fromPayload: payload.referenceImageUrl ? "✅ " + payload.referenceImageUrl.slice(0, 60) : "❌ MISSING",
        fromSourceUrl: payload.sourceUrl ? "✅ present" : "❌ MISSING",
        finalSourceUrl: sourceImageUrl ? "✅ " + sourceImageUrl.slice(0, 60) : "❌ NONE",
      });

      console.log("[processRenderImages] calling image engine", {
        orderId,
        brandId: payload.brandId,
        overlayText: overlayText ? "✅ " + overlayText.slice(0, 50) : "❌ NONE",
      });
      console.log(
        `[job-worker] calling image engine for order=${orderId} brand=${img.brandId ?? payload.brandId} ratio=${aspectRatio}`,
      );

      const imageResult = await callFn<any>("alfie-generate-ai-image", {
        prompt: enrichedPrompt,
        resolution: img.resolution,
        backgroundOnly: false,
        brandKit: await loadBrandMini(img.brandId ?? payload.brandId),
        userId,
        brandId: img.brandId ?? payload.brandId ?? null,
        orderId,
        orderItemId: payload.orderItemId ?? null,
        requestId: payload.requestId ?? null,
        templateImageUrl: img.templateImageUrl ?? payload.referenceImageUrl ?? payload.sourceUrl ?? null,
        uploadedSourceUrl: payload.referenceImageUrl ?? payload.sourceUrl ?? null,
        carousel_id,
        slideIndex,
        useBrandKit,
        userPlan: payload.userPlan,
        overlayText, // ✅ Texte marketing intégré nativement par Gemini 3 Pro
        visualStyleCategory: (img as any).visualStyleCategory ?? payload.visualStyleCategory ?? 'background', // ✅ NEW: Style visuel adaptatif
      });

      const imagePayload = unwrapResult<any>(imageResult);
      const imageError = extractError(imageResult) ?? extractError(imagePayload);
      if (imageError) throw new Error(imageError || "Image generation failed");

      const imageUrl = extractImageUrl(imagePayload) ?? extractImageUrl(imageResult);
      if (!imageUrl) throw new Error("No image URL returned");

      console.log("[processRenderImages] ✅ Image génération complete:", imageUrl);
      
      // ✅ alfie-generate-ai-image a DÉJÀ uploadé sur Cloudinary et inséré dans media_generations
      // library_assets est legacy, media_generations est la source unique de vérité
      
      results.push({ url: imageUrl, aspectRatio, resolution: img.resolution, slideIndex });
    } catch (e) {
      console.error("❌ image_failed", e);
      if (isHttp429(e)) {
        await sleep(1500);
      } else if (isHttp402(e)) {
        throw e; // bubble up to mark job failed permanently
      }
      throw e;
    }
  }

  console.log(`✅ [processRenderImages] done=${results.length}`);

  // Quotas (best-effort)
  if (brandId) {
    if (payload.isAdmin === true) {
      console.log("[quota] admin bypass applied", { brandId, jobId });
    } else {
      console.log("[quota] Consuming", { brandId, cost_woofs: 0, images: results.length });
      try {
        await consumeBrandQuotas(brandId, results.length, 0, 0, {
          userEmail: resolvedUserEmail,
          isAdminFlag: false,
          logContext: "quota",
        });
        console.log("📊 quota_consume", results.length);
      } catch (quotaErr) {
        console.warn("[processRenderImages] quota consumption failed (non-fatal)", quotaErr);
      }
    }
  }

  return { images: results };
}

async function processGenerateVideo(payload: any, jobMeta?: { user_id?: string; order_id?: string; job_id?: string; use_brand_kit?: boolean }) {
  console.log("🎥 [processGenerateVideo] START", {
    orderId: payload?.orderId,
    jobId: jobMeta?.job_id,
    isMultiClip: !!(payload?.clipIndex),
    clipIndex: payload?.clipIndex,
    clipTotal: payload?.clipTotal,
    clipTextLines: payload?.clipTextLines,
  });

  const { userId, brandId, orderId, aspectRatio, duration, prompt, engine, referenceImageUrl, generatedTexts } = payload;
  
  // ✅ MULTI-CLIP: Extraire les données spécifiques au clip
  const isClipJob = payload.clipIndex && payload.clipTotal;
  const clipIndex = payload.clipIndex || 1;
  const clipTotal = payload.clipTotal || 1;
  const clipTextLines: string[] = payload.clipTextLines || [];
  const clipTitle = payload.clipTitle || "";
  const clipKeyframe = payload.clipKeyframe || "";
  const clipAnimation = payload.clipAnimation || "";
  const globalStyle = payload.globalStyle || "";
  
  console.log("[processGenerateVideo] 🎬 Clip data:", {
    isClipJob,
    clipIndex,
    clipTotal,
    clipTitle,
    textLinesCount: clipTextLines.length,
    textLines: clipTextLines,
  });
  
  // ✅ DEBUG TRACE: Vérifier que referenceImageUrl est bien reçu
  console.log("[processGenerateVideo] 📸 referenceImageUrl DEBUG:", {
    fromPayload: referenceImageUrl ? `✅ ${referenceImageUrl.slice(0, 80)}...` : "❌ MISSING",
    payloadKeys: Object.keys(payload),
    promptPreview: prompt?.slice(0, 50),
  });
  
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");

  if (!cloudName) {
    throw new Error("CLOUDINARY_CLOUD_NAME not configured");
  }

  const durationSec = duration || payload.durationSeconds || 8; // ✅ 8s par défaut pour Veo 3.1
  const useBrandKit = resolveUseBrandKit(payload, jobMeta);
  const visualStyleCategory = payload.visualStyleCategory || payload.visualStyle || 'background';
  
  // ✅ Veo 3.1 supporte l'audio généré automatiquement (musique d'ambiance)
  // FORCER true par défaut - Seulement false si explicitement demandé
  const withAudio = payload.withAudio !== false;
  
  console.log("[processGenerateVideo] 🔊 Audio setting:", {
    rawPayloadWithAudio: payload.withAudio,
    resolvedWithAudio: withAudio,
    isExplicitlyFalse: payload.withAudio === false,
  });
  
  // ✅ MULTI-CLIP PRIORITY: Utiliser clipTextLines si disponibles
  let videoScript: { hook?: string; cta?: string; script?: string } | null = null;
  
  if (isClipJob && clipTextLines.length > 0) {
    // ✅ Mode MULTI-CLIP: Utiliser les textes EXACTS du clip
    videoScript = {
      hook: clipTextLines[0] || undefined,
      cta: clipTextLines.length > 1 ? clipTextLines[clipTextLines.length - 1] : undefined,
    };
    console.log("[processGenerateVideo] 🎬 MULTI-CLIP: Using clipTextLines:", {
      clipIndex,
      clipTitle,
      hook: videoScript.hook,
      cta: videoScript.cta,
      allLines: clipTextLines,
    });
  } else if (generatedTexts?.video) {
    // Mode classique: utiliser generatedTexts
    videoScript = generatedTexts.video;
  } else if (prompt) {
    // ✅ FALLBACK: Extraire hook/cta du prompt brut
    const hookPatterns = [
      /Hook\s*:\s*["«]([^"»]+)["»]/i,
      /Accroche\s*:\s*["«]([^"»]+)["»]/i,
      /^["«]([^"»]{10,80})["»]/m,
    ];
    const ctaPatterns = [
      /CTA\s*:\s*["«]([^"»]+)["»]/i,
      /Call.?to.?action\s*:\s*["«]([^"»]+)["»]/i,
      /Commente?\s+["«]?(\w+)["»]?/i,
      /["«]([^"»]{5,30})["»]\s*$/m,
    ];
    
    let extractedHook: string | undefined;
    let extractedCta: string | undefined;
    
    for (const pattern of hookPatterns) {
      const match = prompt.match(pattern);
      if (match?.[1]) {
        extractedHook = match[1].trim();
        break;
      }
    }
    
    for (const pattern of ctaPatterns) {
      const match = prompt.match(pattern);
      if (match?.[1] && match[1] !== extractedHook) {
        extractedCta = match[1].trim();
        break;
      }
    }
    
    if (extractedHook || extractedCta) {
      videoScript = { hook: extractedHook, cta: extractedCta };
      console.log("[processGenerateVideo] 📝 Fallback extraction:", { hook: extractedHook, cta: extractedCta });
    }
  }
  
  // ✅ Charger le brand kit tôt pour le diagnostic
  const brandMini = useBrandKit ? await loadBrandMini(brandId, false) : null;
  
  console.log("[processGenerateVideo] 🏢 Brand Kit check:", {
    useBrandKit,
    hasBrandMini: !!brandMini,
    brandName: brandMini?.name,
    brandNiche: brandMini?.niche,
    brandPalette: brandMini?.palette,
    brandVisualMood: brandMini?.visual_mood,
  });
  
  console.log("[processGenerateVideo] ⚙️ Config:", {
    engine,
    useBrandKit,
    visualStyleCategory,
    withAudio,
    hasScript: !!videoScript,
    hasReferenceImage: !!referenceImageUrl,
    durationSec,
  });

  // ✅ Support VEO 3.1 pour vidéos premium
  if (engine === "veo_3_1") {
    console.log("[processGenerateVideo] Using VEO 3 FAST engine for premium video");
    
    // ✅ Extraire les textes pour overlay vidéo (hook + cta)
    const textForVideo = videoScript ? { 
      hook: videoScript.hook || undefined, 
      cta: videoScript.cta || undefined 
    } : undefined;
    
    console.log("[processGenerateVideo] 📝 Text overlay for Veo 3.1:", {
      hasVideoScript: !!videoScript,
      hook: textForVideo?.hook?.slice(0, 50),
      cta: textForVideo?.cta?.slice(0, 50),
      source: generatedTexts?.video ? "generatedTexts" : "fallback_extraction"
    });
    
    // ✅ CORRECTION ORTHOGRAPHIQUE des textes vidéo AVANT affichage
    let correctedHook = textForVideo?.hook;
    let correctedCta = textForVideo?.cta;

    if (correctedHook || correctedCta) {
      console.log("[processGenerateVideo] ✏️ Proofreading video texts...");
      try {
        const proofResult = await callFn<{ title: string; subtitle: string }>("alfie-proofread-fr", {
          title: correctedHook || "",
          subtitle: correctedCta || "",
        }, 30_000);
        
        if (proofResult?.title) correctedHook = proofResult.title;
        if (proofResult?.subtitle) correctedCta = proofResult.subtitle;
        
        console.log("[processGenerateVideo] ✅ Texts proofread:", {
          hookBefore: textForVideo?.hook?.slice(0, 40),
          hookAfter: correctedHook?.slice(0, 40),
          ctaBefore: textForVideo?.cta?.slice(0, 40),
          ctaAfter: correctedCta?.slice(0, 40),
        });
      } catch (proofError) {
        console.warn("[processGenerateVideo] ⚠️ Proofreading failed, using original texts:", proofError);
      }
    }

    // ✅ PIPELINE "IMAGE FIRST": Générer l'image de référence SI pas déjà fournie
    let effectiveReferenceImageUrl = referenceImageUrl;
    
    if (!effectiveReferenceImageUrl && prompt) {
      console.log("[processGenerateVideo] 🖼️ IMAGE FIRST: Generating reference image...");
      
      try {
        // ✅ Construire overlayLines avec les textes CORRIGÉS
        const overlayLines: string[] = [];
        if (correctedHook) overlayLines.push(correctedHook);
        if (correctedCta) overlayLines.push(correctedCta);
        
        console.log("[processGenerateVideo] 📝 Passing overlayLines to image-for-video:", overlayLines);
        
        const imageResult = await callFn<any>("image-for-video", {
          prompt,
          aspectRatio: aspectRatio || "9:16",
          brandId,
          useBrandKit,
          userId,
          overlayLines: overlayLines.length > 0 ? overlayLines : undefined, // ✅ Passer le texte à afficher
        }, 120_000); // 2 minutes timeout pour image
        
        if (imageResult?.imageUrl) {
          effectiveReferenceImageUrl = imageResult.imageUrl;
          console.log("[processGenerateVideo] ✅ Reference image generated:", effectiveReferenceImageUrl.slice(0, 80));
        } else {
          console.warn("[processGenerateVideo] ⚠️ Image generation returned no URL, continuing with text-to-video");
        }
      } catch (imageError) {
        console.warn("[processGenerateVideo] ⚠️ Image generation failed, continuing with text-to-video:", imageError);
        // Continue without image - Veo 3.1 can do text-to-video
      }
    }
    
    let videoPrompt: string;
    
    if (visualStyleCategory === 'character') {
      // Mode PERSONNAGE: vidéo avec avatar/personnage animé
      const characterStyle = brandMini?.visual_types?.includes('avatars_flat') 
        ? 'animated 2D illustrated character'
        : '3D Pixar-style animated character';
      
      // ✅ Construire le prompt avec texte intégré si disponible
      let textInstruction = "";
      if (textForVideo?.hook || textForVideo?.cta) {
        const parts: string[] = [];
        if (textForVideo.hook) parts.push(`Opening text: "${textForVideo.hook}"`);
        if (textForVideo.cta) parts.push(`Closing text: "${textForVideo.cta}"`);
        textInstruction = ` ${parts.join('. ')}. White bold text with animation.`;
      } else {
        textInstruction = " NO TEXT, NO LETTERS, NO WORDS visible.";
      }
      videoPrompt = `${characterStyle} in motion. ${prompt || 'Professional scene'}. ${brandMini?.niche || 'business'} context. Smooth animation, expressive movements.${textInstruction} Pure cinematic footage.`;
    } else if (visualStyleCategory === 'product' && effectiveReferenceImageUrl) {
      // Mode PRODUIT: vidéo de mise en scène produit
      let textInstruction = "";
      if (textForVideo?.hook || textForVideo?.cta) {
        const parts: string[] = [];
        if (textForVideo.hook) parts.push(`Opening text: "${textForVideo.hook}"`);
        if (textForVideo.cta) parts.push(`Closing text: "${textForVideo.cta}"`);
        textInstruction = ` ${parts.join('. ')}. White bold text with animation.`;
      } else {
        textInstruction = " NO TEXT, NO PRICES, NO LABELS.";
      }
      videoPrompt = `Product showcase video. Smooth camera movement around the product. Professional ${brandMini?.niche || 'e-commerce'} setting. Premium lighting, subtle motion.${textInstruction} Pure visual footage.`;
    } else if (effectiveReferenceImageUrl) {
      // ✅ IMAGE FIRST: Animation d'image - prompt simplifié pour Veo
      videoPrompt = `Animate this scene smoothly. Cinematic camera motion. Professional quality. ${brandMini?.niche || 'business'} context. NO TEXT, NO LETTERS, NO WORDS visible. Pure visual footage.`;
      console.log("[processGenerateVideo] 🎬 Image-to-video animation mode");
    } else {
      // Mode FOND/NORMAL - utiliser buildVideoPrompt avec textOverlay
      videoPrompt = buildVideoPrompt(payload, useBrandKit, brandMini, textForVideo);
    }

    // ✅ ENRICHIR avec Brand Kit (couleurs, niche, mood) directement dans le prompt
    if (useBrandKit && brandMini) {
      const brandEnrichment: string[] = [];
      if (brandMini.palette?.length) {
        brandEnrichment.push(`Brand colors: ${brandMini.palette.slice(0, 3).join(', ')}`);
      }
      if (brandMini.niche) {
        brandEnrichment.push(`Industry: ${brandMini.niche}`);
      }
      if (brandMini.visual_mood?.length) {
        brandEnrichment.push(`Visual mood: ${brandMini.visual_mood.join(', ')}`);
      }
      if (brandEnrichment.length > 0) {
        videoPrompt += ` ${brandEnrichment.join('. ')}.`;
      }
      console.log("[processGenerateVideo] 🎨 Brand Kit enrichment added:", brandEnrichment);
    }

    // ✅ Enrichir le prompt avec des indices de musique si audio activé
    if (withAudio) {
      videoPrompt += " Background music matching the mood. Ambient soundtrack appropriate for the scene.";
      console.log("[processGenerateVideo] 🎵 Audio cues added to prompt");
    }

    // ✅ Appeler generate-video avec provider "veo3" et timeout 6 minutes
    const veoResult = await callFn<any>("generate-video", {
      prompt: videoPrompt,
      aspectRatio: aspectRatio || "9:16",
      withAudio, // ✅ Propager le choix utilisateur (true par défaut)
      duration: durationSec,
      provider: "veo3", // ✅ Explicite: VEO 3 FAST
      userId,
      brandId,
      orderId,
      imageUrl: effectiveReferenceImageUrl, // ✅ Image de référence (générée ou fournie)
      visualStyleCategory, // ✅ NEW: Passer le style visuel
    }, 360_000); // ✅ 6 minutes timeout pour VEO 3

    const videoUrl = veoResult?.videoUrl || veoResult?.output || veoResult?.url;
    if (!videoUrl) throw new Error("VEO 3 FAST failed to generate video");

    console.log("[processGenerateVideo] ✅ VEO 3 FAST video created:", videoUrl);

    // Thumbnail = video URL (VEO 3 génère des vidéos avec couverture)
    const thumbnailUrl = veoResult?.thumbnail_url || videoUrl;

    // ✅ POST-PROD MODE: Router vers tts-and-render-final si postProdMode activé
    const postProdMode = payload.postProdMode === true;
    const overlayLines = payload.overlayLines;
    const voiceoverText = payload.voiceoverText;
    const overlayStyle = payload.overlayStyle;
    
    if (postProdMode && overlayLines?.length > 0) {
      console.log("[processGenerateVideo] 🎬 POST-PROD MODE: Routing to tts-and-render-final...", {
        overlayLinesCount: overlayLines.length,
        hasVoiceover: !!voiceoverText,
        overlayStyle,
      });
      
      try {
        // Créer l'entrée video_renders pour tracker le pipeline
        const { data: renderRow, error: renderErr } = await supabaseAdmin
          .from("video_renders")
          .insert({
            user_id: userId,
            brand_id: brandId,
            order_id: orderId,
            visual_prompt: videoPrompt,
            visual_prompt_en: videoPrompt, // Déjà en anglais
            aspect_ratio: aspectRatio || "9:16",
            duration_seconds: durationSec,
            veo_base_url: videoUrl,
            voiceover_text: voiceoverText || null,
            overlay_spec: {
              lines: overlayLines,
              style: overlayStyle || { font: "Montserrat", size: 72, color: "white", stroke: "black" },
            },
            with_audio: withAudio,
            status: "postprod_pending",
          })
          .select("id")
          .single();
        
        if (renderErr) {
          console.error("[processGenerateVideo] ⚠️ video_renders insert failed:", renderErr);
          // Continue sans post-prod si erreur
        } else {
          console.log("[processGenerateVideo] 📝 video_renders entry created:", renderRow?.id);
          
          // Appeler tts-and-render-final
          const postProdResult = await callFn<any>("tts-and-render-final", {
            videoRenderId: renderRow?.id,
            videoUrl,
            overlayLines,
            overlayStyle: overlayStyle || { font: "Montserrat", size: 72, color: "white", stroke: "black" },
            voiceoverText: voiceoverText || null,
            aspectRatio: aspectRatio || "9:16",
            durationSeconds: durationSec,
            brandId,
            userId,
          }, 300_000); // 5 minutes timeout pour post-prod
          
          if (postProdResult?.finalVideoUrl) {
            console.log("[processGenerateVideo] ✅ POST-PROD complete:", postProdResult.finalVideoUrl);
            
            // Mettre à jour video_renders avec le résultat final
            await supabaseAdmin
              .from("video_renders")
              .update({
                cloudinary_final_url: postProdResult.finalVideoUrl,
                srt: postProdResult.srt || null,
                status: "completed",
              })
              .eq("id", renderRow?.id);
            
            // Sauvegarder dans media_generations avec la vidéo finale
            const { error: mediaErr } = await supabaseAdmin.from("media_generations").insert({
              user_id: userId,
              brand_id: brandId,
              type: "video",
              engine: "veo_3_1_postprod",
              status: "completed",
              output_url: postProdResult.finalVideoUrl,
              thumbnail_url: thumbnailUrl,
              metadata: {
                prompt: videoPrompt,
                aspectRatio,
                duration: durationSec,
                generator: "veo_3_fast_postprod",
                tier: "premium",
                orderId,
                referenceImageUrl: effectiveReferenceImageUrl,
                imageFirstPipeline: !referenceImageUrl && !!effectiveReferenceImageUrl,
                script: videoScript,
                postProdMode: true,
                overlayLines,
                overlayStyle,
                voiceoverText,
                srt: postProdResult.srt,
                rawVideoUrl: videoUrl, // URL vidéo brute avant post-prod
              },
            });
            if (mediaErr) console.error("[processGenerateVideo] ⚠️ media_generations insert failed:", mediaErr);
            
            console.log("[processGenerateVideo] ✅ VEO 3 FAST + POST-PROD saved to media_generations");
            return { videoUrl: postProdResult.finalVideoUrl, rawVideoUrl: videoUrl, srt: postProdResult.srt };
          } else {
            console.warn("[processGenerateVideo] ⚠️ POST-PROD failed, returning raw video");
          }
        }
      } catch (postProdErr) {
        console.error("[processGenerateVideo] ⚠️ POST-PROD pipeline failed:", postProdErr);
        // Fallback: retourner la vidéo brute si post-prod échoue
      }
    }

    // Sauvegarder avec script vidéo dans metadata (mode standard sans post-prod)
    const { error: mediaErr } = await supabaseAdmin.from("media_generations").insert({
      user_id: userId,
      brand_id: brandId,
      type: "video",
      engine: "veo_3_1",
      status: "completed",
      output_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      metadata: {
        prompt: videoPrompt,
        aspectRatio,
        duration: durationSec,
        generator: "veo_3_fast",
        tier: "premium",
        orderId,
        referenceImageUrl: effectiveReferenceImageUrl, // ✅ Stocker l'URL de l'image source (générée ou fournie)
        imageFirstPipeline: !referenceImageUrl && !!effectiveReferenceImageUrl, // ✅ Flag pour indiquer génération automatique
        script: videoScript, // ✅ Stocker le script vidéo (hook, script, cta)
      },
    });
    if (mediaErr) throw new Error(mediaErr.message);

    console.log("[processGenerateVideo] ✅ VEO 3 FAST video saved to media_generations");
    return { videoUrl };
  }

  // Pas de fallback - uniquement Veo 3.1 premium
  throw new Error("Only video_premium (Veo 3.1) is supported. video_basic has been removed.");
}

// ========================================
// processRenderCarousels - Architecture "Carousel Plan First"
// ========================================
async function processRenderCarousels(payload: any, jobMeta?: { user_id?: string; order_id?: string; job_id?: string; use_brand_kit?: boolean }): Promise<any> {
  console.log("[processRenderCarousels] 🚀 START - Architecture 'Carousel Plan First'", {
    orderId: payload.orderId,
    brandId: payload.brandId,
    count: payload.count,
    hasCarouselSlides: !!payload.carousel_slides,
  });

  // ✅ UUID valide pour carousel_id
  const carousel_id = payload.carousel_id || crypto.randomUUID();
  const totalSlides = payload.count || 5;
  const carouselType = payload.carouselType || 'content';
  const carouselMode = payload.carouselMode || 'standard';
  const colorMode = payload.colorMode || 'vibrant'; // ✅ Mode Coloré/Pastel
  const useBrandKit = resolveUseBrandKit(payload, jobMeta);
  
  console.log(`[processRenderCarousels] 📌 Config: ${totalSlides} slides, mode: ${carouselMode}, type: ${carouselType}, colorMode: ${colorMode}, useBrandKit: ${useBrandKit}`);

  // ✅ Charger le Brand Kit
  const brandMini = await loadBrandMini(payload.brandId, false);
  
  // ✅ Extraire le topic (thème) du prompt utilisateur
  const rawTopic = payload.brief?.topic || payload.topic || payload.prompt || "";
  const topic = extractCleanTopic(rawTopic);
  console.log(`[processRenderCarousels] 📝 Topic: "${topic}"`);

  // ========================================
  // ÉTAPE 1: Obtenir le plan de carousel (carousel_slides)
  // ========================================
  let carouselSlides: CarouselSlide[];
  
  // ✅ CONVERSION: Si generatedTexts.slides existe, le convertir en carousel_slides
  if (!payload.carousel_slides && payload.generatedTexts?.slides?.length > 0) {
    console.log(`[processRenderCarousels] ♻️ Converting generatedTexts.slides (${payload.generatedTexts.slides.length}) to carousel_slides`);
    payload.carousel_slides = payload.generatedTexts.slides.map((slide: any, i: number) => ({
      slide_number: i + 1,
      title_on_image: slide.title || "",
      subtitle: slide.subtitle || "",           // ✅ Propager subtitle
      text_on_image: slide.body || "",          // ✅ body → text_on_image
      caption: slide.caption || "",
    }));
  }
  
  // Vérifier si le plan existe déjà dans le payload (évite re-génération sur retry)
  if (payload.carousel_slides && Array.isArray(payload.carousel_slides) && payload.carousel_slides.length > 0) {
    console.log(`[processRenderCarousels] ✅ Using existing carousel_slides from payload (${payload.carousel_slides.length} slides)`);
    carouselSlides = payload.carousel_slides;
  } else {
    // Générer le plan via Gemini (fallback si aucun texte fourni)
    console.log(`[processRenderCarousels] 🎯 Generating carousel plan via Gemini (no existing slides)...`);
    carouselSlides = await generateCarouselPlan(
      topic,
      totalSlides,
      brandMini,
      useBrandKit,
      payload.language || "FR"
    );
    
    // Stocker dans le payload pour les retries
    payload.carousel_slides = carouselSlides;
  }

  // ✅ S'assurer qu'on a exactement le bon nombre de slides
  if (carouselSlides.length < totalSlides) {
    const missing = totalSlides - carouselSlides.length;
    console.log(`[processRenderCarousels] ⚠️ Adding ${missing} missing slides`);
    for (let i = carouselSlides.length; i < totalSlides; i++) {
      carouselSlides.push({
        slide_number: i + 1,
        title_on_image: i === totalSlides - 1 ? "En savoir plus" : topic,
        text_on_image: "",
        caption: "",
      });
    }
  }

  // ✅ Forcer CTA sur la dernière slide
  const lastIdx = carouselSlides.length - 1;
  if (!carouselSlides[lastIdx].title_on_image || carouselSlides[lastIdx].title_on_image.length < 2) {
    carouselSlides[lastIdx].title_on_image = "En savoir plus";
  }

  console.log(`[processRenderCarousels] ✅ Final carousel plan:`, 
    carouselSlides.map((s, i) => `  ${i + 1}: "${s.title_on_image}" | "${s.text_on_image.slice(0, 25)}..."`).join('\n')
  );

  // ========================================
  // ÉTAPE 2: Construire le style visuel
  // ========================================
  const colorDescriptions = useBrandKit && brandMini?.palette?.length
    ? (brandMini.palette || []).slice(0, 3).map(hexToColorName).join(", ")
    : "";
  
  const globalStyle = useBrandKit && brandMini
    ? `${brandMini.niche || 'business'} brand. 
       Visual style: ${(brandMini.visual_mood || ['modern']).join(', ')}, ${(brandMini.visual_types || ['professional photos']).join(', ')}.
       ${brandMini.pitch ? `Brand essence: ${brandMini.pitch}.` : ''}
       Color palette: ${colorDescriptions || 'neutral tones'}.
       ${brandMini.avoid_in_visuals ? `Avoid: ${brandMini.avoid_in_visuals}.` : ''}`
    : `Neutral professional aesthetic. Clean, modern design.`;

  const aspectRatio = payload.brief?.ratio || payload.ratio || "4:5";

  // ========================================
  // ÉTAPE 3: Rendre chaque slide avec le plan
  // ========================================
  console.log(`[processRenderCarousels] 🎨 Rendering ${carouselSlides.length} slides...`);

  // ✅ Extraire visualStyle du payload (background/character/product)
  const visualStyle = payload.visualStyle || 'background';
  console.log(`[processRenderCarousels] 🎨 Visual style: ${visualStyle}`);

  const slidePromises = carouselSlides.map(async (slide: CarouselSlide, index: number) => {
    console.log(`[processRenderCarousels] 📄 Slide ${index + 1}/${carouselSlides.length}: "${slide.title_on_image}"`);

    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[processRenderCarousels] 🔄 Retry ${attempt}/${maxRetries} for slide ${index + 1}`);
          await sleep(1000 * attempt);
        }

        // ✅ ADAPTATIF: Prompt différent selon visualStyle
        let backgroundPrompt: string;
        
        if (visualStyle === 'character') {
          // Mode PERSONNAGE: générer des avatars/personnages 3D
          const characterType = brandMini?.visual_types?.[0] || 'avatars_3d';
          let characterStyle = '3D cartoon character in Pixar/Disney style';
          if (characterType === 'avatars_flat') characterStyle = 'flat 2D illustrated character, modern vector style';
          if (characterType === 'mascotte') characterStyle = 'cute brand mascot character, friendly cartoon figure';
          
          backgroundPrompt = `Create a social media image featuring a CHARACTER.
CHARACTER: ${characterStyle}, expressive, professional appearance
SCENE: ${brandMini?.niche || 'professional'} setting, activity related to the content
MOOD: ${colorMode === 'vibrant' ? 'vibrant saturated colors' : 'soft pastel tones'}
Slide ${index + 1} of ${carouselSlides.length}.
CRITICAL: Character must be central. NO TEXT whatsoever - no letters, words, labels.
Leave space at top for text overlay.`;
        } else if (visualStyle === 'product' && payload.referenceImageUrl) {
          // Mode PRODUIT: mise en scène du produit uploadé
          backgroundPrompt = `Create a professional PRODUCT SHOWCASE image.
Use the reference image as inspiration for the product to feature.
SCENE: Professional ${brandMini?.niche || 'e-commerce'} product photography setting
BACKGROUND: ${colorMode === 'vibrant' ? 'vibrant colorful gradients' : 'soft pastel background'}
Slide ${index + 1} of ${carouselSlides.length}.
CRITICAL: Product must be central subject. NO TEXT whatsoever - no letters, prices, labels.
Leave space at top for text overlay.`;
        } else {
          // Mode FOND ABSTRAIT (défaut)
          backgroundPrompt = `Abstract colorful background for social media carousel.
NO TEXT whatsoever - no letters, words, numbers, labels.
ONLY abstract shapes, gradients, patterns, visual elements.
Style: ${colorMode === 'vibrant' ? 'vibrant saturated colors, bold gradients' : 'soft pastel tones, gentle gradients'}.
${useBrandKit && brandMini?.niche ? `Theme context: ${brandMini.niche} brand.` : ''}
${useBrandKit && brandMini?.visual_mood?.length ? `Mood: ${brandMini.visual_mood.join(', ')}.` : ''}
Slide ${index + 1} of ${carouselSlides.length}.`;
        }

        const slideResult = await callFn("alfie-render-carousel-slide", {
          userId: jobMeta?.user_id || payload.userId,
          prompt: backgroundPrompt,
          globalStyle,
          brandKit: brandMini,
          slideContent: {
            // ✅ Textes stockés dans text_json pour récupération (pas de rendu overlay)
            title: slide.title_on_image || "",
            subtitle: slide.subtitle || "",             // ✅ Propager subtitle explicitement
            body: slide.text_on_image || "",            // ✅ Propager body (text_on_image)
            bullets: (slide as any).bullets || [],
            alt: `Slide ${index + 1}: ${slide.title_on_image}`,
            author: (slide as any).author || undefined,
          },
          brandId: payload.brandId,
          orderId: jobMeta?.order_id || payload.orderId,
          orderItemId: payload.orderItemId || null,
          carouselId: carousel_id,
          slideIndex: index,
          totalSlides: carouselSlides.length,
          aspectRatio,
          textVersion: 1,
          renderVersion: 1,
          campaign: payload.campaign || payload.brief?.campaign || "carousel",
          language: payload.language || "FR",
          useBrandKit,
          carouselMode, // ✅ Mode depuis payload (standard/background_only)
          carouselType,
          colorMode,
          visualStyle, // ✅ NEW: Passer le style visuel adaptatif
          referenceImageUrl: payload.referenceImageUrl || null,
          backgroundOnly: carouselMode === 'background_only', // ✅ Flag dynamique selon mode
        });

        return { success: true, slideIndex: index, result: slideResult };
      } catch (error: any) {
        lastError = error;
        console.error(`[processRenderCarousels] ❌ Attempt ${attempt + 1} failed for slide ${index + 1}:`, error.message);
      }
    }

    return { success: false, slideIndex: index, error: lastError?.message || "Unknown error" };
  });

  const results = await Promise.all(slidePromises);
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  if (failedCount > 0) {
    console.warn(`[processRenderCarousels] ⚠️ ${failedCount} slides failed`);
  }

  // Consommer le quota pour les slides réussies
  if (successCount > 0) {
    try {
      await consumeBrandQuotas(
        payload.brandId,
        successCount, // 1 Woof per slide
        0, // videos
        0  // woofs
      );
      console.log(`✅ [consumeBrandQuotas] Consumed ${successCount} Woofs for carousel slides`);
    } catch (quotaErr) {
      console.error("❌ [processRenderCarousels] Quota consumption failed:", quotaErr);
    }
  }

  return {
    carousel_id,
    totalSlides: carouselSlides.length,
    successCount,
    failedCount,
    results,
  };
}

/**
 * Nettoie le topic brut pour extraire le thème réel
 */
function extractCleanTopic(rawTopic: string | undefined): string {
  if (!rawTopic) return "Votre sujet";
  
  let cleaned = rawTopic;
  
  // Patterns à supprimer
  const structurePatterns = [
    /^[🎨🧩📸🎬🎥✨🚀💡📝🔥]*\s*/g,
    /carrousel\s*\d+\s*slides?\s*[–\-:]*\s*/gi,
    /carrousel\s+de\s+\d+\s+slides?\s*:?\s*/gi,
    /slide\s*\d+\s*:\s*/gi,
    /^ajouter\s+un?\s+visuels?\s*/gi,
    /^créer?\s+un?\s+carrousel\s*/gi,
    /^génère\s+/gi,
    /^faire\s+/gi,
    /^fais(-|\s+)?(moi|un|une|des|du)?\s*/gi,
    /^je\s+veux\s+(du|de\s+la|des|un|une)?\s*/gi,
    /^crée\s+(moi\s+)?(un|une|des)?\s*/gi,
  ];
  
  // Extraire le contenu entre guillemets s'il existe
  const quotedMatch = rawTopic.match(/"([^"]+)"/);
  if (quotedMatch && quotedMatch[1] && quotedMatch[1].length > 5) {
    return quotedMatch[1].trim();
  }
  
  // Nettoyer avec les patterns
  for (const pattern of structurePatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  if (!cleaned || cleaned.length < 3) {
    const significantWords = rawTopic
      .split(/[:\s,–\-]+/)
      .filter(w => w.length > 3 && !/^(avec|pour|dans|slide|slides|carrousel|visuels?|ajouter|créer|génère|faire|fais|crée|je|veux|moi|du|de|la|le|les|un|une|des)$/i.test(w));
    
    if (significantWords.length > 0) {
      cleaned = significantWords.slice(0, 5).join(' ');
    }
  }
  
  return cleaned || "Votre sujet";
}

// ========== CASCADE JOB CREATION ==========

async function createCascadeJobs(job: JobRow, result: any, sb: SupabaseClient) {
  console.log("📋 [Cascade] order:", job.order_id);

  // Try to fetch order_items (with small retry)
  let orderItems: any[] = [];
  for (let i = 0; i < 8; i++) {
    const { data, error } = await sb
      .from("order_items")
      .select("*")
      .eq("order_id", job.order_id)
      .order("sequence_number");
    if (!error && data?.length) {
      orderItems = data;
      break;
    }
    await sleep(120);
  }

  // Fallback from payload if still empty
  if (!orderItems.length) {
    console.warn("🧪 no_items_after_texts → payload fallback");
    const { imageBriefs = [], carouselBriefs = [], brandId } = job.payload ?? {};
    const cascadeJobs: any[] = [];

    imageBriefs.forEach((brief: any, index: number) => {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: "render_images",
        status: "queued",
        payload: {
          userId: job.user_id,
          orderId: job.order_id,
          brief,
          textData: result.texts,
          brandId,
          imageIndex: index,
          fallbackMode: true,
        },
      });
    });

    carouselBriefs.forEach((brief: any, index: number) => {
      cascadeJobs.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: "render_carousels",
        status: "queued",
        payload: {
          userId: job.user_id,
          orderId: job.order_id,
          brief,
          textData: result.texts,
          brandId,
          carouselIndex: index,
          fallbackMode: true,
        },
      });
    });

    if (cascadeJobs.length) {
      const { data: existing } = await sb
        .from("job_queue")
        .select("id, type, status")
        .eq("order_id", job.order_id)
        .in("status", ["queued", "processing", "running"]);

      const existingKeys = new Set(existing?.map((j: any) => `${j.type}_${j.status}`) || []);
      const toInsert = cascadeJobs.filter((j) => !existingKeys.has(`${j.type}_${j.status}`));

      if (toInsert.length) {
        const { error: insErr } = await sb.from("job_queue").insert(toInsert);
        if (insErr) console.error("❌ fallback cascade insert", insErr);
        else {
          console.log(`✅ fallback cascade created: ${toInsert.length}`);
          await safeReinvoke(sb);
        }
      } else {
        console.log("ℹ️ fallback: all jobs already exist");
      }
    }
    return;
  }

  // Normal cascade from order_items
  const toCreate: any[] = [];
  for (const item of orderItems) {
    if (item.type === "carousel") {
      toCreate.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: "render_carousels",
        status: "queued",
        payload: {
          userId: job.user_id,
          orderId: job.order_id,
          orderItemId: item.id,
          brief: item.brief_json,
          textData: result.texts,
          brandId: job.payload?.brandId,
          carouselIndex: item.sequence_number,
        },
      });
    } else if (item.type === "image") {
      toCreate.push({
        user_id: job.user_id,
        order_id: job.order_id,
        type: "render_images",
        status: "queued",
        payload: {
          userId: job.user_id,
          orderId: job.order_id,
          orderItemId: item.id,
          brief: item.brief_json,
          textData: result.texts,
          brandId: job.payload?.brandId,
          imageIndex: item.sequence_number,
        },
      });
    }
  }

  if (toCreate.length) {
    const { data: existing } = await sb
      .from("job_queue")
      .select("id, type, status")
      .eq("order_id", job.order_id)
      .in("status", ["queued", "processing", "running"]);

    const existingKeys = new Set(existing?.map((j: any) => `${j.type}_${j.status}`) || []);
    const toInsert = toCreate.filter((j) => !existingKeys.has(`${j.type}_${j.status}`));

    if (toInsert.length) {
      const { error: insErr } = await sb.from("job_queue").insert(toInsert);
      if (insErr) console.error("❌ cascade insert", insErr);
      else {
        console.log(`✅ cascade created: ${toInsert.length}`);
        await safeReinvoke(sb);
      }
    } else {
      console.log("ℹ️ cascade: jobs already exist");
    }
  }
}

// ---------- helpers ----------
async function loadBrandMini(brandId?: string, full = true) {
  if (!brandId) return undefined;
  
  // ✅ Always load Brand Kit V2 fields + fonts + text_color + logo_url + avatar_url for personalized generation
  const { data, error } = await supabaseAdmin
    .from("brands")
    .select("name, palette, fonts, voice, niche, pitch, adjectives, visual_types, visual_mood, avoid_in_visuals, text_color, logo_url, avatar_url")
    .eq("id", brandId)
    .maybeSingle();
    
  if (error || !data) return undefined;
  
  console.log(`[loadBrandMini] fonts:`, JSON.stringify(data.fonts), `palette:`, JSON.stringify(data.palette), `text_color:`, data.text_color, `logo_url:`, data.logo_url ? "✅" : "❌", `avatar_url:`, data.avatar_url ? "✅" : "❌");
  
  return {
    name: data.name,
    palette: data.palette,
    fonts: data.fonts, // ✅ Include fonts for carousel overlays
    voice: data.voice,
    niche: data.niche,
    pitch: data.pitch,
    adjectives: data.adjectives,
    visual_types: data.visual_types,
    visual_mood: data.visual_mood,
    avoid_in_visuals: data.avoid_in_visuals,
    text_color: data.text_color, // ✅ Include text_color for carousel overlays
    logo_url: data.logo_url, // ✅ Logo commercial
    avatar_url: data.avatar_url, // ✅ V10: Avatar/mascotte pour personnages
  };
}

async function safeReinvoke(sb: SupabaseClient) {
  try {
    await sb.functions.invoke("alfie-job-worker", { body: { trigger: "cascade" } });
    console.log("▶️ worker reinvoked");
  } catch (e) {
    console.warn("⚠️ reinvoke failed", e);
  }
}

