// supabase/functions/alfie-job-worker/index.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadFromUrlToCloudinary } from "../_shared/cloudinaryUploader.ts";
import { consumeBrandQuotas } from "../_shared/quota.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_FN_SECRET } from "../_shared/env.ts";

import { corsHeaders } from "../_shared/cors.ts";
type JobRow = {
  id: string;
  user_id: string;
  order_id: string;
  type: "generate_texts" | "render_images" | "render_carousels" | "generate_video";
  status: "queued" | "running" | "completed" | "failed";
  retry_count: number | null;
  max_retries: number | null;
  payload: any;
  error?: string | null;
};

const supabaseAdmin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

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

async function callFn<T = unknown>(name: string, body: unknown): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(`Missing Supabase configuration for ${name}`);
  }
  if (!INTERNAL_FN_SECRET) {
    throw new Error(`Missing INTERNAL_FN_SECRET for ${name}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

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
      throw new Error(`${name} timed out after 60s`);
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

// ---------- HTTP Entrypoint ----------
Deno.serve(async (req) => {
  console.log("[alfie-job-worker] 🚀 Invoked at", new Date().toISOString());
  console.log("[job-worker] start");
  
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("🚀 [Worker] Starting job processing...");

    // Basic env sanity
    console.log("🧪 env", {
      supabaseUrl: !!Deno.env.get("SUPABASE_URL"),
      anonKey: !!Deno.env.get("SUPABASE_ANON_KEY"),
      serviceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    });

    // Quick probe
    const { count: queued } = await supabaseAdmin
      .from("job_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");
    console.log("[WORKER] Boot: " + (queued ?? 0) + " jobs queued in job_queue");

    // Process a small batch to avoid function timeout
    const results: Array<{ job_id: string; success: boolean; error?: string; retried?: boolean }> = [];
    const maxJobs = 5;
    let processed = 0;

    for (let i = 0; i < maxJobs; i++) {
      const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_next_job");
      if (claimError) {
        console.error("❌ claim_next_job", claimError);
        break;
      }
      if (!claimed || claimed.length === 0) {
        if ((queued ?? 0) > 0) console.warn("🧪 claim_empty_but_queued_gt0");
        console.log(`ℹ️ No more jobs to process (processed ${processed})`);
        console.log("[job-worker] no job claimed");
        break;
      }

      const job = claimed[0];

      console.log(`[job-worker] claimed job ${job.id} type=${job.type}`);

      // Anonymize job ID for logging
      const jobIdPrefix = job.id.substring(0, 8);
      console.log("🟢 start_job", { id: `${jobIdPrefix}...`, type: job.type });

      try {
        let result: any;

        switch (job.type) {
          case "generate_texts":
            result = await processGenerateTexts(job.payload);
            break;
          case "render_images":
            result = await processRenderImages(job.payload);
            break;
          case "render_carousels":
            result = await processRenderCarousels(job.payload);
            break;
          case "generate_video":
            result = await processGenerateVideo(job.payload);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }

        await supabaseAdmin
          .from("job_queue")
          .update({ status: "completed", result, updated_at: new Date().toISOString() })
          .eq("id", job.id);

        console.log("✅ job_done", { id: job.id, type: job.type });
        processed++;
        results.push({ job_id: job.id, success: true });

        // Check for remaining jobs and reinvoke if needed
        const { data: remainingJobs } = await supabaseAdmin
          .from("job_queue")
          .select("id")
          .eq("status", "queued")
          .limit(1);

        if (remainingJobs && remainingJobs.length > 0) {
          console.log("[alfie-job-worker] 🔁 Remaining jobs detected, reinvoking...");
          try {
            const { error: invokeError } = await supabaseAdmin.functions.invoke("alfie-job-worker", {
              body: { trigger: "self-reinvoke" }
            });
            if (invokeError) {
              console.error("[alfie-job-worker] ⚠️ Reinvoke failed:", invokeError);
            }
          } catch (e) {
            console.error("[alfie-job-worker] ⚠️ Reinvoke error:", e);
          }
        }

        // Cascade for text → generate children jobs
        if (job.type === "generate_texts") {
          await createCascadeJobs(job, result, supabaseAdmin);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
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
        } else {
          await supabaseAdmin
            .from("job_queue")
            .update({
              status: "failed",
              error: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          console.log(`❌ permanently_failed ${job.id}`);
          results.push({ job_id: job.id, success: false, retried: false, error: message });
        }
      }
    }

    return ok({ success: true, processed, results });
  } catch (e) {
    console.error("❌ [Worker] Fatal", e);
    return err(e instanceof Error ? e.message : "Unknown error");
  }
});

// ========== JOB PROCESSORS ==========

async function processGenerateTexts(payload: any) {
  console.log("📝 [processGenerateTexts]");

  const { brief, brandKit, count = 1, type } = payload;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

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

  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

  const { error: mediaErr } = await supabaseAdmin.from("media_generations").insert({
    user_id: userId,
    brand_id: brandId,
    type: "image",
    status: "completed",
    output_url: imageUrl,
    thumbnail_url: imageUrl,
    metadata: { prompt, sourceUrl, orderId },
    expires_at: expiresAt,
  });
  if (mediaErr) throw new Error(mediaErr.message);

  const { error: libErr } = await supabaseAdmin.from("library_assets").insert({
    user_id: userId,
    brand_id: brandId,
    order_id: orderId,
    type: "image",
    cloudinary_url: imageUrl,
    tags: ["studio", "auto"],
    metadata: { prompt, sourceUrl, orderId },
  } as any);
  if (libErr) throw new Error(libErr.message);

  return { imageUrl };
}

async function processRenderImages(payload: any) {
  console.log("🖼️ [processRenderImages] payload.in", payload);

  if (
    payload &&
    typeof payload.prompt === "string" &&
    payload.prompt.trim().length > 0 &&
    !payload.images &&
    !payload.brief
  ) {
    return processRenderImage(payload);
  }

  if (!payload?.userId || !payload?.orderId) {
    throw new Error("Invalid render_images payload: missing userId or orderId");
  }

  const payloadEmail = typeof payload?.userEmail === "string" ? payload.userEmail.toLowerCase() : null;
  let resolvedUserEmail = payloadEmail;

  if (!resolvedUserEmail) {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(payload.userId);
    if (authError) {
      console.error("[job-worker] failed to resolve user email", authError);
    }
    resolvedUserEmail = authUser?.user?.email?.toLowerCase() ?? null;
  }

  const results: Array<{ url: string; aspectRatio: string; resolution: string }> = [];
  let imagesToRender: Array<{
    prompt: string;
    resolution: string;
    aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
    brandId?: string;
    briefIndex?: number;
    templateImageUrl?: string;
  }> = [];

  if (payload.images) {
    imagesToRender = payload.images;
  } else if (payload.brief) {
    const { briefs } = payload.brief;
    const brandId = payload.brandId;

    const { data: brand } = await supabaseAdmin
      .from("brands")
      .select("name, palette, voice, niche")
      .eq("id", brandId)
      .single();

    const AR_MAP: Record<string, { w: number; h: number }> = {
      "1:1": { w: 1024, h: 1024 },
      "4:5": { w: 1080, h: 1350 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 },
    };

    imagesToRender = (briefs || [payload.brief]).map((brief: any, i: number) => {
      const aspectRatio = (brief?.format?.split(" ")?.[0] as string) || "1:1";
      const { w, h } = AR_MAP[aspectRatio] || AR_MAP["1:1"];

      const prompt = `${brief?.content || "A detailed subject scene"}.
Style: ${brief?.style || "realistic photo or clean illustration"}.
Context: ${brief?.objective || "social media post"}.
Brand: ${brand?.niche || ""}, tone: ${brand?.voice || "professional"}.
Colors: ${brand?.palette?.slice(0, 3).join(", ") || "modern palette"}.
Composition: clear main subject, depth, lighting, natural shadows. No text overlays.
Format: ${aspectRatio} aspect ratio optimized.`;

      return {
        prompt,
        resolution: `${w}x${h}`,
        aspectRatio: aspectRatio as any,
        brandId,
        briefIndex: i,
      };
    });
  } else {
    throw new Error("Invalid payload: missing images or brief");
  }

  console.log(`🖼️ [processRenderImages] total=${imagesToRender.length}`);

  for (const img of imagesToRender) {
    const aspectRatio = img.aspectRatio || "4:5";
    try {
      // 1) generate
      console.log(
        `[job-worker] calling image engine for order=${payload.orderId} brand=${img.brandId ?? payload.brandId} ratio=${aspectRatio}`,
      );
      const imageResult = await callFn<any>("alfie-generate-ai-image", {
        prompt: img.prompt,
        resolution: img.resolution,
        backgroundOnly: false,
        brandKit: await loadBrandMini(img.brandId ?? payload.brandId),
        userId: payload.userId,
        brandId: img.brandId ?? payload.brandId ?? null,
        orderId: payload.orderId,
        orderItemId: payload.orderItemId ?? null,
        requestId: payload.requestId ?? null,
        templateImageUrl: img.templateImageUrl ?? payload.sourceUrl ?? null,
        uploadedSourceUrl: payload.sourceUrl ?? null,
      });

      const imagePayload = unwrapResult<any>(imageResult);
      const imageError = extractError(imageResult) ?? extractError(imagePayload);
      if (imageError) throw new Error(imageError || "Image generation failed");

      const imageUrl =
        (typeof imagePayload === "string"
          ? imagePayload
          : getResultValue<string>(imagePayload, ["imageUrl", "url", "outputUrl", "output_url"])) ??
        getResultValue<string>(imageResult, ["imageUrl", "url", "outputUrl", "output_url"]);
      if (!imageUrl) throw new Error("No image URL returned");

      // 2) upload cloudinary from URL
      console.log("[job-worker] uploaded image engine result, pushing to Cloudinary", { imageUrl });
      const cloud = await uploadFromUrlToCloudinary(imageUrl, {
        folder: `alfie/${img.brandId ?? payload.brandId}/orders/${payload.orderId}`,
        publicId: `image_${results.length + 1}`,
        tags: ["ai-generated", "alfie", `brand:${img.brandId ?? payload.brandId}`, `order:${payload.orderId}`, `type:image`, `ratio:${aspectRatio}`],
        context: {
          order_id: String(payload.orderId),
          order_item_id: String(payload.orderItemId ?? ""),
          brand_id: String(img.brandId ?? payload.brandId ?? ""),
          aspect_ratio: aspectRatio,
          type: "image",
        },
      });

      // 3) persist media_generations (best-effort)
      await supabaseAdmin.from("media_generations").insert({
        user_id: payload.userId,
        brand_id: img.brandId ?? null,
        type: "image",
        status: "completed",
        output_url: cloud.secureUrl,
        thumbnail_url: cloud.secureUrl,
        prompt: img.prompt,
        metadata: {
          orderId: payload.orderId,
          orderItemId: payload.orderItemId ?? null,
          aspectRatio,
          resolution: img.resolution,
          source: "worker",
          cloudinary_public_id: cloud.publicId,
        },
      });

      // 4) idempotent library_assets
      const { data: existing } = await supabaseAdmin
        .from("library_assets")
        .select("id")
        .eq("order_id", payload.orderId)
        .eq("cloudinary_public_id", cloud.publicId)
        .maybeSingle();

      if (!existing) {
        console.log("💾 inserting library_asset", { userId: payload.userId, orderId: payload.orderId, publicId: cloud.publicId });
        const { data: assetRows, error: libErr } = await supabaseAdmin
          .from("library_assets")
          .insert({
            user_id: payload.userId,
            brand_id: img.brandId ?? payload.brandId ?? null,
            order_id: payload.orderId,
            order_item_id: payload.orderItemId ?? null,
            type: "image",
            cloudinary_url: cloud.secureUrl,
            cloudinary_public_id: cloud.publicId,
            format: aspectRatio,
            tags: ["ai-generated", "alfie", `order:${payload.orderId}`],
            metadata: {
              orderId: payload.orderId,
              orderItemId: payload.orderItemId ?? null,
              aspectRatio,
              resolution: img.resolution,
              source: "alfie-job-worker",
              cloudinary_public_id: cloud.publicId,
              width: cloud.width,
              height: cloud.height,
            },
          })
          .select("id")
          .single();
        if (libErr) {
          console.error("❌ library_asset insert failed", libErr);
          throw new Error(`Failed to save to library: ${libErr.message}`);
        }
        console.log(`[job-worker] inserted asset ${assetRows?.id} into library_assets`);
      } else {
        console.log("ℹ️ library_asset already exists", existing.id);
      }

      console.log(`[job-worker] uploaded image to Cloudinary publicId=${cloud.publicId}`);
      results.push({ url: cloud.secureUrl, aspectRatio, resolution: img.resolution });
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
  try {
    await consumeBrandQuotas(payload.brandId, results.length, 0, 0, {
      userEmail: resolvedUserEmail,
      isAdminFlag: payload.isAdmin === true,
      logContext: "quota",
    });
    console.log("📊 quota_consume", results.length);
  } catch (qErr) {
    console.warn("⚠️ quota_consume_failed", qErr);
  }

  return { images: results };
}

async function processRenderCarousels(payload: any) {
  console.log("📚 [processRenderCarousels] START", {
    hasSlides: !!payload?.slides,
    slidesCount: Array.isArray(payload?.slides) ? payload.slides.length : 0,
    hasBrief: !!payload?.brief,
    briefCount: payload?.brief?.briefs?.length || 0,
    userId: payload?.userId,
    brandId: payload?.brandId,
    orderId: payload?.orderId
  });

  // ✅ Phase B: Removed alfie-render-carousel call (function doesn't exist)
  // Always convert payload.slides to carousel object and use slide-by-slide rendering

  let carouselsToRender: any[] = [];

  // ✅ Phase B: Handle payload.slides by converting to carousel format
  if (Array.isArray(payload?.slides) && payload.slides.length > 0) {
    const { userId, brandId, orderId } = payload || {};
    if (!userId || !brandId || !orderId) {
      throw new Error("Invalid render_carousels payload: missing userId, brandId, or orderId");
    }

    // Convert slides array to carousel object for slide-by-slide processing
    carouselsToRender = [{
      id: crypto.randomUUID(),
      aspectRatio: payload.aspectRatio || "9:16",
      textVersion: 1,
      slides: payload.slides,
      prompts: payload.slides.map((_: any, i: number) => `Slide ${i + 1}`),
      style: "minimalist",
      brandId,
    }];
  } else if (payload.carousels) {
    carouselsToRender = payload.carousels;
  } else if (payload.brief) {
    const { briefs } = payload.brief;
    const brandId = payload.brandId;
    const brandMini = await loadBrandMini(brandId, true);

    const planPromises = (briefs || [payload.brief]).map(async (brief: any) => {
      const slideCount =
        typeof brief?.numSlides === "number" ? brief.numSlides : parseInt(String(brief?.numSlides ?? "5")) || 5;

      const planResult = await callFn<any>("alfie-plan-carousel", {
        prompt: brief?.topic ?? "Carousel",
        slideCount,
        brandKit: brandMini,
      });

      const planPayload = unwrapResult<any>(planResult);
      const planError = extractError(planResult) ?? extractError(planPayload);
      if (planError) throw new Error(planError);

      const planObject =
        (planPayload && typeof planPayload === "object"
          ? (planPayload as Record<string, any>)
          : null) ??
        (typeof planResult === "object" && planResult !== null
          ? (planResult as Record<string, any>)
          : null);

      if (!planObject) throw new Error("Plan returned invalid payload");

      const slides = Array.isArray(planObject.slides) ? planObject.slides : [];
      if (slides.length === 0) throw new Error("Plan returned no slides");

      const prompts = Array.isArray(planObject.prompts) ? planObject.prompts : [];
      const style =
        typeof planObject.style === "string"
          ? planObject.style
          : typeof (planObject as any).meta?.style === "string"
            ? (planObject as any).meta.style
            : "minimalist";

      return {
        id: crypto.randomUUID(),
        aspectRatio: payload.aspectRatio || "9:16",
        textVersion: 1,
        slides,
        prompts,
        style,
        brandId,
      };
    });

    carouselsToRender = await Promise.all(planPromises);
  } else {
    throw new Error("Invalid payload: missing carousels or brief");
  }

  const results: any[] = [];

  for (const carousel of carouselsToRender) {
    console.log("🎠 rendering_carousel", { slides: carousel.slides?.length, id: carousel.id });

    if (!Array.isArray(carousel.slides) || carousel.slides.length === 0) {
      throw new Error("Carousel has no slides");
    }

    const slidesOut: Array<{ index: number; url: string; publicId?: string; text: any }> = [];

    for (let i = 0; i < carousel.slides.length; i++) {
      const slide = carousel.slides[i];
      const slidePrompt = carousel.prompts?.[i] || `Slide ${i + 1}`;

      let attempt = 0;
      const maxRetry = 2;

      while (true) {
        try {
          const slideResult = await callFn<any>("alfie-render-carousel-slide", {
            userId: payload.userId,
            prompt: slidePrompt,
            globalStyle: carousel.style || "minimalist",
            slideContent: slide,
            brandId: carousel.brandId,
            orderId: payload.orderId,
            orderItemId: payload.orderItemId ?? null,
            carouselId: carousel.id,
            slideIndex: i,
            totalSlides: carousel.slides.length,
            aspectRatio: carousel.aspectRatio || "9:16",
            textVersion: carousel.textVersion || 1,
            renderVersion: 1,
            campaign: "carousel_generation",
            language: "FR",
            requestId: payload.requestId ?? null,
          });

          const slidePayload = unwrapResult<any>(slideResult);
          const slideError = extractError(slideResult) ?? extractError(slidePayload);
          if (slideError) throw new Error(slideError);

          const cloudinaryUrl =
            (typeof slidePayload === "string"
              ? slidePayload
              : getResultValue<string>(slidePayload, ["cloudinary_url", "url"])) ??
            getResultValue<string>(slideResult, ["cloudinary_url", "url"]);
          const cloudinaryPublicId =
            getResultValue<string>(slidePayload, ["cloudinary_public_id"]) ??
            getResultValue<string>(slideResult, ["cloudinary_public_id"]);

          if (!cloudinaryUrl) throw new Error("Slide renderer did not return cloudinary_url");

          slidesOut.push({
            index: i,
            url: cloudinaryUrl,
            publicId: cloudinaryPublicId ?? undefined,
            text: slide,
          });
          break;
        } catch (e) {
          attempt++;
          if (isHttp429(e) && attempt <= maxRetry) {
            const backoff = Math.round(Math.pow(1.6, attempt) * 1200);
            console.warn(`⏳ rate_limited retry=${attempt}/${maxRetry} wait=${backoff}ms`);
            await sleep(backoff);
            continue;
          }
          throw e;
        }
      }
    }

    try {
      await consumeBrandQuotas(carousel.brandId, slidesOut.length, 0, 0, {
        userEmail: payload?.userEmail ?? null,
        isAdminFlag: payload?.isAdmin === true,
        logContext: "quota",
      });
      console.log("📊 quota_consume", slidesOut.length);
    } catch (qErr) {
      console.warn("⚠️ quota_consume_failed", qErr);
    }

    results.push({ carouselId: carousel.id, slides: slidesOut, totalSlides: slidesOut.length });
    console.log("✅ carousel_done", { id: carousel.id, slides: slidesOut.length });
  }

  return { carousels: results };
}

async function processGenerateVideo(payload: any) {
  console.log("🎥 [processGenerateVideo]", payload?.orderId);

  const { userId, brandId, orderId, aspectRatio, duration, prompt, sourceUrl, sourceType } = payload;

  // ✅ Phase C: Use existing generate-video function instead of non-existent alfie-assemble-video
  const renderResult = await callFn<any>("generate-video", {
    userId, // ✅ Required for internal call validation
    aspectRatio,
    duration,
    prompt,
    sourceUrl,
    sourceType,
    brandId,
    orderId,
  });

  const renderPayload = unwrapResult<any>(renderResult);
  const renderError = extractError(renderResult) ?? extractError(renderPayload);
  if (renderError) throw new Error(renderError || "Video render failed");

  let videoUrl =
    (typeof renderPayload === "string"
      ? renderPayload
      : getResultValue<string>(renderPayload, ["video_url", "videoUrl", "output_url", "outputUrl"])) ??
    getResultValue<string>(renderResult, ["video_url", "videoUrl", "output_url", "outputUrl"]);

  if (!videoUrl) throw new Error("Missing video_url from renderer response");

  const thumbnailUrl =
    getResultValue<string>(renderPayload, ["thumbnail_url", "thumbnailUrl", "preview_url", "previewUrl"]) ??
    getResultValue<string>(renderResult, ["thumbnail_url", "thumbnailUrl", "preview_url", "previewUrl"]);

  const seconds = Number(duration) || 12;
  const woofs = Math.max(1, Math.ceil(seconds / 12));

  const { error: debitError } = await supabaseAdmin.rpc("debit_woofs", {
    user_id_input: userId,
    amount: woofs,
  });
  if (debitError) throw new Error(debitError.message);

  const { error: assetErr } = await supabaseAdmin.from("media_generations").insert({
    user_id: userId,
    brand_id: brandId,
    type: "video",
    status: "completed",
    output_url: videoUrl,
    thumbnail_url: thumbnailUrl ?? null,
    metadata: {
      aspectRatio,
      duration: seconds,
      prompt,
      sourceUrl,
      sourceType,
      generator: "generate-video",
      woofs,
      orderId,
      thumbnailUrl: thumbnailUrl ?? undefined,
    },
  });
  if (assetErr) throw new Error(assetErr.message);

  return { videoUrl };
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
        .in("status", ["queued", "running"]);

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
      .in("status", ["queued", "running"]);

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
async function loadBrandMini(brandId?: string, full = false) {
  if (!brandId) return undefined;
  
  type BrandMini = { name: string | null; palette: any; voice: any; niche?: any };
  
  const { data, error } = await supabaseAdmin
    .from("brands")
    .select(full ? "name, palette, voice, niche" : "name, palette, voice")
    .eq("id", brandId)
    .maybeSingle();
    
  if (error || !data) return undefined;
  
  const brand = data as unknown as BrandMini;
  return {
    name: brand.name,
    palette: brand.palette,
    voice: brand.voice,
    niche: full ? brand.niche : undefined,
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

/**
 * 🔧 SQL attendu côté DB pour claim_next_job:
 *
 * create or replace function claim_next_job()
 * returns setof job_queue
 * language plpgsql
 * as $$
 * declare r job_queue%rowtype;
 * begin
 *   update job_queue
 *   set status = 'running',
 *       updated_at = now()
 *   where id in (
 *     select id from job_queue
 *     where status = 'queued'
 *     order by created_at asc
 *     limit 1
 *     for update skip locked
 *   )
 *   returning * into r;
 *   if found then
 *     return next r;
 *   end if;
 * end;
 * $$;
 */
