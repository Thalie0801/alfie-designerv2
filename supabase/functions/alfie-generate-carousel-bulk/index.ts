// functions/alfie-render-carousel-bulk/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_FN_SECRET") ?? "";

type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

type SlideInput = Record<string, unknown>; // ton schema de slide texte (title, subtitle, bullets, etc.)

interface CarouselInput {
  id?: string;
  aspectRatio?: AspectRatio;
  globalStyle?: Record<string, unknown>;
  slides: SlideInput[];
}

interface BulkRequestBody {
  carousels: CarouselInput[];
  brandId?: string | null;
  orderId?: string | null;
  globalStyle?: Record<string, unknown>;
  textVersion?: "v1" | "v2";
  /** Limite de slides traitées en parallèle (par défaut 4) */
  concurrency?: number;
  /** Nombre de retries par slide (par défaut 2) */
  retries?: number;
  /** Propager l’Authorization à la fonction slide (si elle attend un contexte user) */
  forwardAuth?: boolean;
}

interface SlideSuccess {
  ok: true;
  slideIndex: number;
  data: any;
  cloudinaryUrl?: string;
}

interface SlideFailure {
  ok: false;
  slideIndex: number;
  error: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Utilitaires */

function isArray(v: unknown): v is any[] {
  return Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeAspect(aspect?: unknown): AspectRatio {
  const a = String(aspect ?? "4:5");
  return (["1:1", "4:5", "9:16", "16:9"].includes(a) ? a : "4:5") as AspectRatio;
}

function normalizeCarousel(input: any, fallbackAspect: AspectRatio): CarouselInput | null {
  if (!input || typeof input !== "object") return null;
  const slides = isArray(input.slides) ? input.slides : [];
  if (slides.length === 0) return null;

  return {
    id: isNonEmptyString(input.id) ? input.id : crypto.randomUUID(),
    aspectRatio: safeAspect(input.aspectRatio ?? fallbackAspect),
    globalStyle: (typeof input.globalStyle === "object" && input.globalStyle) || undefined,
    slides,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Concurrence simple (p-limit like) */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) {
  let i = 0;
  const running: Promise<void>[] = [];
  while (i < items.length) {
    while (running.length < limit && i < items.length) {
      const p = worker(items[i], i).catch(() => {
        /* already handled in worker */
      });
      running.push(
        p.finally(() => {
          const ix = running.indexOf(p);
          if (ix >= 0) running.splice(ix, 1);
        }),
      );
      i++;
    }
    if (running.length) {
      await Promise.race(running);
    }
  }
  await Promise.allSettled(running);
}

/** Retry avec backoff (500ms, 900ms, 1300ms, …) */
async function withRetries<T>(fn: () => Promise<T>, retries: number, label: string): Promise<T> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      attempt++;
      if (attempt > retries) break;
      const delay = 500 + attempt * 400;
      console.warn(`↻ Retry ${attempt}/${retries} after ${delay}ms for ${label}`, e);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!INTERNAL_SECRET) {
      console.error("[Carousel Bulk] Missing INTERNAL_FN_SECRET");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const startTs = Date.now();
    console.log(`🎨 [Carousel Bulk] User=${userId}`);

    // --- Parse & validate body
    const body = (await req.json()) as Partial<BulkRequestBody>;
    if (!body || !isArray(body.carousels) || body.carousels.length === 0) {
      return new Response(JSON.stringify({ error: "carousels array is required and must be non-empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brandId = isNonEmptyString(body.brandId) ? body.brandId : null;
    const orderId = isNonEmptyString(body.orderId) ? body.orderId : null;
    const textVersion = (body.textVersion === "v2" ? "v2" : "v1") as "v1" | "v2";
    const forwardAuth = Boolean(body.forwardAuth);

    const defaultAspect: AspectRatio = "4:5";
    const normalizedCarousels: CarouselInput[] = [];
    for (const raw of body.carousels) {
      const norm = normalizeCarousel(raw, defaultAspect);
      if (norm) normalizedCarousels.push(norm);
    }
    if (normalizedCarousels.length === 0) {
      return new Response(JSON.stringify({ error: "No valid carousels provided (slides missing)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Concurrence & retries
    const concurrency = clamp(Number(body.concurrency ?? 4), 1, 16);
    const retries = clamp(Number(body.retries ?? 2), 0, 5);

    console.log(
      `🧮 [Carousel Bulk] Carousels=${normalizedCarousels.length} | Concurrency=${concurrency} | Retries=${retries}`,
    );

    // Résultats agrégés
    const bulkResults: Array<{
      carouselId: string;
      aspectRatio: AspectRatio;
      totalSlides: number;
      slides: Array<SlideSuccess | SlideFailure>;
    }> = [];

    // Traitement carousel par carousel (on pourrait paralléliser ici aussi si besoin)
    for (const carousel of normalizedCarousels) {
      const carouselId = carousel.id!;
      const aspectRatio = carousel.aspectRatio ?? "4:5";
      const slidesOut: Array<SlideSuccess | SlideFailure> = [];
      const totalSlides = carousel.slides.length;

      console.log(`📚 [Carousel ${carouselId}] ${totalSlides} slides, aspect=${aspectRatio}`);

      // Prépare la liste de jobs (un job = une slide)
      const jobs = carousel.slides.map((slideContent, slideIndex) => ({
        slideContent,
        slideIndex,
      }));

      // Worker d’exécution pour une slide
      const worker = async (job: { slideContent: SlideInput; slideIndex: number }, idx: number) => {
        const label = `carousel=${carouselId} slide=${job.slideIndex + 1}/${totalSlides}`;

        const exec = async () => {
          const headers: Record<string, string> = forwardAuth && authHeader
            ? { Authorization: authHeader, "X-Internal-Secret": INTERNAL_SECRET }
            : { "X-Internal-Secret": INTERNAL_SECRET };

          const { data: slideData, error: slideError } = await supabaseAdmin.functions.invoke(
            "alfie-render-carousel-slide",
            {
              body: {
                userId,
                slideContent: job.slideContent,
                globalStyle: carousel.globalStyle ?? body.globalStyle ?? {},
                brandId,
                orderId,
                orderItemId: null,
                carouselId,
                slideIndex: job.slideIndex,
                totalSlides,
                aspectRatio,
                textVersion,
                renderVersion: "v1",
                context: "bulk",
                requestId: null,
              },
              headers,
            },
          );

          if (slideError) {
            throw new Error(slideError.message || "Slide render failed");
          }
          if (!slideData) {
            throw new Error("Empty slide response");
          }

          // Normalisation d’un champ utile si dispo (facultatif)
          const cloudinaryUrl =
            slideData?.cloudinaryUrl ||
            slideData?.cloudinary_url ||
            slideData?.data?.cloudinaryUrl ||
            slideData?.data?.cloudinary_url;

          slidesOut[job.slideIndex] = {
            ok: true,
            slideIndex: job.slideIndex,
            data: slideData,
            cloudinaryUrl,
          };
          console.log(`✅ [${label}] OK`);
        };

        try {
          await withRetries(exec, retries, label);
        } catch (e: any) {
          const msg = e?.message || String(e);
          slidesOut[job.slideIndex] = {
            ok: false,
            slideIndex: job.slideIndex,
            error: msg,
          };
          console.error(`❌ [${label}] ${msg}`);
        }
      };

      // Lance les slides avec limite de concurrence
      await runWithConcurrency(jobs, concurrency, worker);

      // Pousse le résultat pour ce carousel
      bulkResults.push({
        carouselId,
        aspectRatio,
        totalSlides,
        slides: slidesOut,
      });

      const okCount = slidesOut.filter((s) => s.ok).length;
      console.log(`✅ [Carousel ${carouselId}] ${okCount}/${totalSlides} slides ok`);
    }

    // Statuts globaux
    const totalCarousels = bulkResults.length;
    const totalSlides = bulkResults.reduce((acc, c) => acc + c.totalSlides, 0);
    const okSlides = bulkResults.reduce((acc, c) => acc + c.slides.filter((s) => s.ok).length, 0);
    const failedSlides = totalSlides - okSlides;

    const success = failedSlides === 0;
    const partial_success = !success && okSlides > 0;

    const durationMs = Date.now() - startTs;
    console.log(
      `🏁 [Carousel Bulk] Done in ${durationMs}ms | Carousels=${totalCarousels} | Slides OK=${okSlides}/${totalSlides}`,
    );

    return new Response(
      JSON.stringify({
        success,
        partial_success,
        stats: {
          carousels: totalCarousels,
          totalSlides,
          okSlides,
          failedSlides,
          durationMs,
        },
        carousels: bulkResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("❌ [Carousel Bulk] Crash:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
