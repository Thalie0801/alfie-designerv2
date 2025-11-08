import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildImageThumbnailUrl } from "../_shared/cloudinaryUtils.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = SUPABASE_URL ?? Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase configuration is missing for generate-carousel-video");
    }

    const bearerToken = req.headers.get("Authorization");
    if (!bearerToken) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const token = bearerToken.replace("Bearer", "").trim();
    if (!token) {
      return json({ error: "Invalid authorization header" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const user = userData.user;
    const payload = await req.json().catch(() => ({}));

    const carouselIdRaw = typeof payload?.carousel_id === "string" ? payload.carousel_id.trim() : "";
    const orderIdRaw = typeof payload?.order_id === "string" ? payload.order_id.trim() : "";

    if (!carouselIdRaw && !orderIdRaw) {
      return json({ error: "carousel_id or order_id is required" }, 400);
    }

    const aspectRaw = typeof payload?.aspect === "string" ? payload.aspect.trim() : "";
    const durationPerSlide = Number(payload?.duration_per_slide ?? payload?.durationPerSlide);
    const audioPublicId = typeof payload?.audio_public_id === "string"
      ? payload.audio_public_id
      : typeof payload?.audioPublicId === "string"
      ? payload.audioPublicId
      : null;

    const clientForData = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const slidesQuery = clientForData
      .from("library_assets")
      .select(
        "id, brand_id, user_id, order_id, carousel_id, slide_index, cloudinary_public_id, cloudinary_url, format, text_json, metadata",
      )
      .eq("type", "carousel_slide")
      .eq("user_id", user.id)
      .order("slide_index", { ascending: true });

    if (carouselIdRaw) {
      slidesQuery.eq("carousel_id", carouselIdRaw);
    } else if (orderIdRaw) {
      slidesQuery.eq("order_id", orderIdRaw);
    }

    const { data: slides, error: slidesError } = await slidesQuery;
    if (slidesError) {
      console.error("[generate-carousel-video] Failed to load slides", slidesError);
      return json({ error: "Unable to load carousel slides" }, 500);
    }

    if (!slides || slides.length === 0) {
      return json({ error: "No slides found for this carousel" }, 404);
    }

    const brandId = slides[0]?.brand_id as string | null;
    const derivedOrderId = (slides[0]?.order_id as string | null) ?? (orderIdRaw || null);
    const derivedCarouselId = (slides[0]?.carousel_id as string | null) ?? (carouselIdRaw || null);

    if (!brandId || !derivedOrderId) {
      return json({ error: "Missing brand or order information for carousel" }, 400);
    }

    const normalizedSlides = slides
      .map((slide) => {
        const publicId = slide.cloudinary_public_id as string | null;
        if (!publicId) return null;
        return {
          id: slide.id as string,
          slide_index: typeof slide.slide_index === "number" ? slide.slide_index : null,
          cloudinary_public_id: publicId,
          cloudinary_url: slide.cloudinary_url as string | null,
          format: slide.format as string | null,
        };
      })
      .filter((slide): slide is {
        id: string;
        slide_index: number | null;
        cloudinary_public_id: string;
        cloudinary_url: string | null;
        format: string | null;
      } => !!slide);

    if (!normalizedSlides.length) {
      return json({ error: "Slides are missing Cloudinary public IDs" }, 400);
    }

    const jobPayload: Record<string, unknown> = {
      userId: user.id,
      brandId,
      orderId: derivedOrderId,
      carouselId: derivedCarouselId,
      slides: normalizedSlides,
      durationPerSlide: Number.isFinite(durationPerSlide) && durationPerSlide > 0 ? durationPerSlide : 2,
    };

    if (aspectRaw) jobPayload.aspect = aspectRaw;
    if (audioPublicId) jobPayload.audioPublicId = audioPublicId;

    const title = typeof payload?.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : (slides[0]?.text_json as any)?.title;
    if (title) jobPayload.title = title;

    const subtitle = typeof payload?.subtitle === "string" && payload.subtitle.trim()
      ? payload.subtitle.trim()
      : undefined;
    if (subtitle) jobPayload.subtitle = subtitle;

    const cta = typeof payload?.cta === "string" && payload.cta.trim() ? payload.cta.trim() : undefined;
    if (cta) jobPayload.cta = cta;

    // Avoid duplicate queued jobs for the same carousel
    let duplicateQuery = clientForData
      .from("job_queue")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("type", "stitch_carousel_video")
      .eq("status", "queued")
      .limit(1);

    if (derivedCarouselId) {
      duplicateQuery = duplicateQuery.eq("payload->>carouselId", derivedCarouselId);
    }

    const duplicateCheck = await duplicateQuery.maybeSingle();

    if (duplicateCheck?.data?.id) {
      return json({
        ok: true,
        job_id: duplicateCheck.data.id,
        order_id: derivedOrderId,
        carousel_id: derivedCarouselId,
        slide_count: normalizedSlides.length,
        duplicate: true,
      }, 202);
    }

    const { data: jobRow, error: jobError } = await clientForData
      .from("job_queue")
      .insert({
        user_id: user.id,
        order_id: derivedOrderId,
        type: "stitch_carousel_video",
        payload: jobPayload,
      })
      .select("id")
      .single();

    if (jobError) {
      console.error("[generate-carousel-video] Failed to enqueue job", jobError);
      return json({ error: "Unable to create video generation job" }, 500);
    }

    const previewThumbnail = buildImageThumbnailUrl({
      secureUrl: normalizedSlides[0]?.cloudinary_url ?? undefined,
      publicId: normalizedSlides[0]?.cloudinary_public_id,
      format: normalizedSlides[0]?.format,
    });

    return json({
      ok: true,
      job_id: jobRow?.id ?? null,
      order_id: derivedOrderId,
      carousel_id: derivedCarouselId,
      slide_count: normalizedSlides.length,
      thumbnail_url: previewThumbnail,
    }, 202);
  } catch (error) {
    console.error("[generate-carousel-video] Unexpected error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
