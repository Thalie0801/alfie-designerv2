// supabase/functions/alfie-job-worker/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToCloudinary } from "../_shared/cloudinaryUploader.ts";
import { consumeBrandQuotas } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

// ---------- HTTP Entrypoint ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("🚀 [Worker] Boot");

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
    console.log("🧪 probe.queue_count", queued ?? 0);

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
        break;
      }

      const job: JobRow = claimed[0];
      console.log("🟢 start_job", { id: job.id, type: job.type, order_id: job.order_id });

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

async function processRenderImages(payload: any) {
  console.log("🖼️ [processRenderImages] payload.in", payload);

  const results: Array<{ url: string; aspectRatio: string; resolution: string }> = [];
  let imagesToRender: Array<{
    prompt: string;
    resolution: string;
    aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
    brandId?: string;
    briefIndex?: number;
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
      console.log("🎨 generate", { aspectRatio, resolution: img.resolution });
      const { data, error } = await supabaseAdmin.functions.invoke("alfie-generate-ai-image", {
        body: {
          prompt: img.prompt,
          resolution: img.resolution,
          backgroundOnly: false,
          brandKit: await loadBrandMini(img.brandId),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Image generation failed");

      const imageUrl = data?.imageUrl || data?.data?.imageUrl;
      if (!imageUrl) throw new Error("No image URL returned");

      // 2) upload cloudinary
      console.log("📤 upload cloudinary");
      const cloud = await uploadToCloudinary(imageUrl, {
        folder: `brands/${img.brandId}/images`,
        publicId: `order_${payload.orderId}_img_${results.length + 1}`,
        tags: ["ai-generated", "worker", `order-${payload.orderId}`],
        context: {
          order_id: String(payload.orderId),
          order_item_id: String(payload.orderItemId ?? ""),
          brand_id: String(img.brandId ?? ""),
          aspect_ratio: aspectRatio,
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
        .eq("order_item_id", payload.orderItemId ?? null)
        .eq("cloudinary_url", cloud.secureUrl)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("library_assets").insert({
          user_id: payload.userId,
          brand_id: img.brandId ?? null,
          order_id: payload.orderId,
          order_item_id: payload.orderItemId ?? null,
          type: "image",
          cloudinary_url: cloud.secureUrl,
          format: aspectRatio,
          metadata: {
            orderId: payload.orderId,
            orderItemId: payload.orderItemId ?? null,
            aspectRatio,
            resolution: img.resolution,
            source: "worker",
            cloudinary_public_id: cloud.publicId,
          },
        });
      }

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
    await consumeBrandQuotas(payload.brandId, results.length);
    console.log("📊 quota_consume", results.length);
  } catch (qErr) {
    console.warn("⚠️ quota_consume_failed", qErr);
  }

  return { images: results };
}

async function processRenderCarousels(payload: any) {
  console.log("📚 [processRenderCarousels]");

  let carouselsToRender: any[] = [];

  if (payload.carousels) {
    carouselsToRender = payload.carousels;
  } else if (payload.brief) {
    const { briefs } = payload.brief;
    const brandId = payload.brandId;
    const brandMini = await loadBrandMini(brandId, true);

    const planPromises = (briefs || [payload.brief]).map(async (brief: any) => {
      const slideCount =
        typeof brief?.numSlides === "number" ? brief.numSlides : parseInt(String(brief?.numSlides ?? "5")) || 5;

      const { data, error } = await supabaseAdmin.functions.invoke("alfie-plan-carousel", {
        body: { prompt: brief?.topic ?? "Carousel", slideCount, brandKit: brandMini },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      const slides = data?.slides;
      if (!Array.isArray(slides) || slides.length === 0) throw new Error("Plan returned no slides");

      return {
        id: crypto.randomUUID(),
        aspectRatio: payload.aspectRatio || "9:16",
        textVersion: 1,
        slides,
        prompts: data?.prompts || [],
        style: data?.style || "minimalist",
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
          const { data, error } = await supabaseAdmin.functions.invoke("alfie-render-carousel-slide", {
            body: {
              userId: payload.userId,
              prompt: slidePrompt,
              globalStyle: carousel.style || "minimalist",
              slideContent: slide,
              brandId: carousel.brandId,
              orderId: payload.orderId,
              carouselId: carousel.id,
              slideIndex: i,
              totalSlides: carousel.slides.length,
              aspectRatio: carousel.aspectRatio || "9:16",
              textVersion: carousel.textVersion || 1,
              renderVersion: 1,
              campaign: "carousel_generation",
              language: "FR",
            },
          });

          if (error || data?.error) throw new Error(data?.error || error?.message);

          slidesOut.push({
            index: i,
            url: data.cloudinary_url,
            publicId: data.cloudinary_public_id,
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
      await consumeBrandQuotas(carousel.brandId, slidesOut.length);
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

  const { userId, brandId, orderId, aspectRatio, duration, prompt, sourceUrl } = payload;

  const { data, error } = await supabaseAdmin.functions.invoke("alfie-assemble-video", {
    body: { aspectRatio, duration, prompt, sourceUrl, brandId, orderId },
  });
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Video assembly failed");
  }

  const videoUrl = data?.video_url;
  if (!videoUrl) throw new Error("Missing video_url from assembler response");

  const { error: assetErr } = await supabaseAdmin.from("media_generations").insert({
    user_id: userId,
    brand_id: brandId,
    order_id: orderId,
    type: "video",
    status: "completed",
    output_url: videoUrl,
    metadata: { aspectRatio, duration, prompt, sourceUrl, generator: "assemble-video" },
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
