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
  type: "generate_texts" | "render_images" | "render_carousels" | "generate_video" | "animate_image";
  status: "queued" | "processing" | "running" | "completed" | "failed";
  retry_count: number | null;
  max_retries: number | null;
  payload: any;
  error?: string | null;
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
            // ✅ on passe aussi user_id / order_id pour réparer les payloads legacy
            result = await processRenderImages(job.payload, {
              user_id: job.user_id,
              order_id: job.order_id,
              job_id: job.id,
            });
            break;
          case "render_carousels":
            // Utiliser processRenderImages pour les carrousels également
            result = await processRenderImages(job.payload, {
              user_id: job.user_id,
              order_id: job.order_id,
              job_id: job.id,
            });
            break;
          case "generate_video":
            result = await processGenerateVideo(job.payload);
            break;
          case "animate_image":
            result = await processAnimateImage(job.payload);
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

  // ⚠️ SECURITY: NEVER store base64 URLs in database (saturation prevention)
  if (imageUrl.startsWith('data:')) {
    console.error('[alfie-job-worker] 🚨 BLOCKED: base64 URL forbidden in database');
    throw new Error('SECURITY: base64 URLs are forbidden. Use Cloudinary URLs only.');
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


async function processRenderImages(
  payload: any,
  jobMeta?: { user_id?: string | null; order_id?: string | null; job_id?: string | null },
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
  const brandId = (payload.brandId as string | undefined) ?? null;

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

  let imagesToRender: Array<{
    prompt: string;
    resolution: string;
    aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
    brandId?: string;
    briefIndex?: number;
    templateImageUrl?: string;
    slideIndex?: number;
  }> = [];

  if (payload.images) {
    imagesToRender = payload.images;
  } else if (resolvedKind && typeof payload.count === "number") {
    const ratioToUse = ratioFromPayload || "4:5";
    const { w, h } = AR_MAP[ratioToUse] || AR_MAP["4:5"];
    const basePrompt = briefText || payload.topic || "Alfie creative image";

    imagesToRender = Array.from({ length: imagesCount }).map((_, index) => ({
      prompt: `${basePrompt}. ${resolvedKind === "carousel" ? `Carousel slide ${index + 1}.` : ""} Format ${ratioToUse}.`,
      resolution: `${w}x${h}`,
      aspectRatio: (ratioToUse as "1:1" | "4:5" | "9:16" | "16:9") ?? "4:5",
      brandId: brandId ?? undefined,
      slideIndex: resolvedKind === "carousel" ? index : undefined,
    }));
  } else if (payload.brief) {
    const { briefs } = payload.brief;
    const brandIdLocal = payload.brandId;

    const { data: brand } = await supabaseAdmin
      .from("brands")
      .select("name, palette, voice, niche")
      .eq("id", brandIdLocal)
      .single();

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
    try {
      // 1) generate
      console.log("[processRenderImages] calling image engine", {
        orderId,
        brandId: payload.brandId,
      });
      console.log(
        `[job-worker] calling image engine for order=${orderId} brand=${img.brandId ?? payload.brandId} ratio=${aspectRatio}`,
      );

      const imageResult = await callFn<any>("alfie-generate-ai-image", {
        prompt: img.prompt,
        resolution: img.resolution,
        backgroundOnly: false,
        brandKit: await loadBrandMini(img.brandId ?? payload.brandId),
        userId,
        brandId: img.brandId ?? payload.brandId ?? null,
        orderId,
        orderItemId: payload.orderItemId ?? null,
        requestId: payload.requestId ?? null,
        templateImageUrl: img.templateImageUrl ?? payload.sourceUrl ?? null,
        uploadedSourceUrl: payload.sourceUrl ?? null,
      });

      const imagePayload = unwrapResult<any>(imageResult);
      const imageError = extractError(imageResult) ?? extractError(imagePayload);
      if (imageError) throw new Error(imageError || "Image generation failed");

      const imageUrl = extractImageUrl(imagePayload) ?? extractImageUrl(imageResult);
      if (!imageUrl) throw new Error("No image URL returned");

      console.log("[processRenderImages] engine returned imageUrl", imageUrl);
      console.log("[processRenderImages] engine responded", {
        imageUrl,
        orderId,
        brandId: img.brandId ?? payload.brandId,
      });

      // 2) upload cloudinary from URL
      console.log("[job-worker] uploaded image engine result, pushing to Cloudinary", {
        imageUrl,
      });
      const cloud = await uploadFromUrlToCloudinary(imageUrl, {
        folder: `alfie/${img.brandId ?? payload.brandId}/orders/${orderId}`,
        publicId: `image_${results.length + 1}`,
        tags: [
          "ai-generated",
          "alfie",
          `brand:${img.brandId ?? payload.brandId}`,
          `order:${orderId}`,
          `type:${assetType}`,
          `ratio:${aspectRatio}`,
        ],
        context: {
          order_id: String(orderId),
          order_item_id: String(payload.orderItemId ?? ""),
          brand_id: String(img.brandId ?? payload.brandId ?? ""),
          aspect_ratio: aspectRatio,
          type: assetType,
        },
      });
      console.log("[job-worker] uploaded image to Cloudinary publicId=" + cloud.publicId);

      // 3) persist media_generations (best-effort)
      await supabaseAdmin.from("media_generations").insert({
        user_id: userId,
        brand_id: img.brandId ?? null,
        type: "image",
        status: "completed",
        output_url: cloud.secureUrl,
        thumbnail_url: cloud.secureUrl,
        prompt: img.prompt,
        metadata: {
          orderId,
          orderItemId: payload.orderItemId ?? null,
          aspectRatio,
          resolution: img.resolution,
          source: "worker",
          cloudinary_public_id: cloud.publicId,
          width: cloud.width,
          height: cloud.height,
          ratio: aspectRatio,
          kind: resolvedKind ?? "image",
          slide_index: slideIndex,
          brief: briefText,
        },
      });

      // 4) idempotent library_assets
      const { data: existing } = await supabaseAdmin
        .from("library_assets")
        .select("id")
        .eq("order_id", orderId)
        .eq("cloudinary_public_id", cloud.publicId)
        .maybeSingle();

      if (!existing) {
        console.log("💾 inserting library_asset", {
          userId,
          orderId,
          publicId: cloud.publicId,
        });
        const { data: assetRows, error: libErr } = await supabaseAdmin
          .from("library_assets")
          .insert({
            user_id: userId,
            brand_id: img.brandId ?? payload.brandId ?? null,
            order_id: orderId,
            order_item_id: payload.orderItemId ?? null,
            type: assetType as any,
            cloudinary_url: cloud.secureUrl,
            cloudinary_public_id: cloud.publicId,
            format: aspectRatio,
            tags: ["ai-generated", "alfie", `order:${orderId}`],
            metadata: {
              orderId,
              orderItemId: payload.orderItemId ?? null,
              aspectRatio,
              resolution: img.resolution,
              source: "alfie-job-worker",
              cloudinary_public_id: cloud.publicId,
              width: cloud.width,
              height: cloud.height,
              ratio: aspectRatio,
              brief: briefText,
              kind: resolvedKind ?? "image",
              slide_index: slideIndex,
            },
          })
          .select("id")
          .single();
        if (libErr) {
          console.error("❌ library_asset insert failed", libErr);
          throw new Error(`Failed to save to library: ${libErr.message}`);
        }
        console.log("[processRenderImages] Completed job", {
          jobId,
          assetId: assetRows?.id,
          cloudinaryPublicId: cloud.publicId,
          orderId,
        });
      } else {
        console.log("ℹ️ library_asset already exists", existing.id);
      }

      console.log(`[job-worker] uploaded image to Cloudinary publicId=${cloud.publicId}`);
      results.push({ url: cloud.secureUrl, aspectRatio, resolution: img.resolution, slideIndex });
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

async function processGenerateVideo(payload: any) {
  console.log("🎥 [processGenerateVideo]", payload?.orderId);

  const { userId, brandId, orderId, aspectRatio, duration, prompt, sourceUrl, sourceType, provider } = payload;

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
    provider, // ✅ Pass provider (vertex_veo for premium)
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

  // ✅ FIXED: Woofs already consumed by generate-video via woofs-check-consume
  // Removing duplicate debit_woofs call to prevent double-counting

  const { error: assetErr } = await supabaseAdmin.from("media_generations").insert({
    user_id: userId,
    brand_id: brandId,
    type: "video",
    status: "completed",
    output_url: videoUrl,
    thumbnail_url: thumbnailUrl ?? null,
    metadata: {
      aspectRatio,
      duration: duration || 10,
      prompt,
      sourceUrl,
      sourceType,
      generator: "generate-video",
      provider,
      orderId,
      thumbnailUrl: thumbnailUrl ?? undefined,
    },
  });
  if (assetErr) throw new Error(assetErr.message);

  return { videoUrl };
}

async function processAnimateImage(payload: any) {
  console.log("🎬 [processAnimateImage]", payload?.orderId);

  const { userId, brandId, orderId, imagePublicId, cloudName, title, subtitle, duration, aspect } = payload;

  if (!imagePublicId || !cloudName) {
    throw new Error("Missing imagePublicId or cloudName for animation");
  }

  const animateResult = await callFn<any>("animate-image", {
    userId,
    brandId,
    orderId,
    imagePublicId,
    cloudName,
    title,
    subtitle,
    duration: duration || 3,
    aspect: aspect || "4:5",
  });

  const animatePayload = unwrapResult<any>(animateResult);
  const animateError = extractError(animateResult) ?? extractError(animatePayload);
  if (animateError) throw new Error(animateError || "Image animation failed");

  const videoUrl = animatePayload?.videoUrl || animatePayload?.data?.videoUrl;
  if (!videoUrl) throw new Error("Missing videoUrl from animate-image response");

  console.log("✅ [processAnimateImage] Animated image:", videoUrl);

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

