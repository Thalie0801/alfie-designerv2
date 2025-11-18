import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!INTERNAL_FN_SECRET) {
  throw new Error("Missing INTERNAL_FN_SECRET");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type StudioMediaType = "image" | "carousel" | "video";

interface StudioGenerateRequest {
  type: StudioMediaType;
  prompt: string;
  brandId: string;
  aspectRatio: string;
  quantity?: number;
  duration?: number;
  slides?: number;
  inputMedia?: { type: "image" | "video"; url: string }[];
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse(
        { ok: false, error: "Missing authorization" },
        { status: 401 },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[studio-generate] auth error", authError);
      return jsonResponse(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as StudioGenerateRequest;

    if (!body.brandId || !body.prompt || !body.type) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing required fields: type, prompt, brandId",
        },
        { status: 400 },
      );
    }

    console.log(
      `[studio-generate] ${body.type} request from user ${user.id}`,
    );

    let resourceId: string | null = null;
    let resourceType: "media" | "order" = "media";

    const referenceImage = body.inputMedia?.find((m) => m.type === "image");
    const referenceVideo = body.inputMedia?.find((m) => m.type === "video");

    // Helper pour les résolutions d'image
    const resolveResolution = (ratio: string): string => {
      switch (ratio) {
        case "1:1":
          return "1080x1080";
        case "9:16":
          return "1080x1920";
        case "16:9":
          return "1920x1080";
        case "4:5":
          return "1080x1350";
        default:
          return "1080x1080";
      }
    };

    // ---------- IMAGE : alfie-render-image ----------
    if (body.type === "image") {
      const resolution = resolveResolution(body.aspectRatio);
      const payload: Record<string, unknown> = {
        userId: user.id,
        brand_id: body.brandId,
        prompt: body.prompt,
        resolution,
        provider: "lovable",
        model: "nano-banana",
      };

      if (referenceImage) {
        payload.templateImageUrl = referenceImage.url;
      }

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/alfie-render-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": INTERNAL_FN_SECRET,
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.ok) {
        const details =
          typeof result?.error === "string"
            ? result.error
            : typeof result?.code === "string"
            ? result.code
            : "GENERATION_FAILED";

        console.error("[studio-generate] alfie-render-image failed", {
          status: res.status,
          details,
        });

        if (res.status === 402) {
          return jsonResponse(
            { ok: false, error: "Insufficient AI credits" },
            { status: 402 },
          );
        }

        if (res.status === 429) {
          return jsonResponse(
            { ok: false, error: "Rate limit exceeded" },
            { status: 429 },
          );
        }

        throw new Error(details);
      }

      const generationId =
        typeof result?.data?.generation_id === "string"
          ? result.data.generation_id
          : typeof result?.data?.id === "string"
          ? result.data.id
          : null;

      if (!generationId) {
        console.error(
          "[studio-generate] Missing generation_id in alfie-render-image response",
          { data: result?.data },
        );
        throw new Error("GENERATION_ID_MISSING");
      }

      resourceId = generationId;
      resourceType = "media";
    }

    // ---------- CAROUSEL : generate-media ----------
    else if (body.type === "carousel") {
      const count =
        body.quantity && body.quantity > 0 ? body.quantity : 1;

      const carouselBody = {
        userId: user.id,
        intent: {
          brandId: body.brandId,
          format: "carousel" as const,
          count,
          topic: body.prompt,
          ratio:
            body.aspectRatio === "4:5"
              ? "4:5"
              : body.aspectRatio === "9:16"
              ? "9:16"
              : "1:1",
        },
      };

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-media`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: authHeader,
          },
          body: JSON.stringify(carouselBody),
        },
      );

      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.ok) {
        const details =
          typeof result?.message === "string"
            ? result.message
            : typeof result?.error === "string"
            ? result.error
            : "GENERATION_FAILED";

        console.error("[studio-generate] generate-media failed", {
          status: res.status,
          details,
        });

        if (res.status === 402) {
          return jsonResponse(
            { ok: false, error: "Insufficient quota or credits" },
            { status: 402 },
          );
        }

        throw new Error(details);
      }

      const orderId =
        typeof result?.data?.orderId === "string" &&
        result.data.orderId.length > 0
          ? result.data.orderId
          : null;

      if (!orderId) {
        console.error(
          "[studio-generate] Missing orderId from generate-media",
          { data: result?.data },
        );
        throw new Error("ORDER_ID_MISSING");
      }

      resourceId = orderId;
      resourceType = "order";
    }

    // ---------- VIDEO : alfie-orchestrator ----------
    else if (body.type === "video") {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/alfie-orchestrator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: authHeader,
          },
          body: JSON.stringify({
            kind: "video",
            prompt: body.prompt,
            message: body.prompt,
            user_message: body.prompt,
            brandId: body.brandId,
            forceTool: "generate_video",
            aspectRatio: body.aspectRatio,
            quantity: body.quantity ?? 1,
            durationSec: body.duration ?? 12,
            uploadedSourceUrl:
              referenceVideo?.url ??
              referenceImage?.url ??
              null,
            uploadedSourceType:
              (referenceVideo?.type ??
                referenceImage?.type ??
                null) as "image" | "video" | null,
          }),
        },
      );

      const result = await res.json().catch(() => null);

      if (!res.ok || result?.error) {
        const details =
          typeof result?.error === "string"
            ? result.error
            : typeof result?.message === "string"
            ? result.message
            : "GENERATION_FAILED";

        console.error("[studio-generate] alfie-orchestrator failed", {
          status: res.status,
          details,
        });

        if (res.status === 402) {
          return jsonResponse(
            { ok: false, error: "Insufficient quota or credits" },
            { status: 402 },
          );
        }

        throw new Error(details);
      }

      const orderId =
        typeof result?.orderId === "string" &&
        result.orderId.length > 0
          ? result.orderId
          : null;

      if (!orderId) {
        console.error(
          "[studio-generate] Missing orderId from alfie-orchestrator",
          { data: result },
        );
        throw new Error("ORDER_ID_MISSING");
      }

      resourceId = orderId;
      resourceType = "order";
    } else {
      throw new Error(`Unsupported media type: ${body.type}`);
    }

    if (!resourceId) {
      throw new Error("RESOURCE_ID_MISSING");
    }

    return jsonResponse({
      ok: true,
      resourceId,
      type: resourceType,
    });
  } catch (error) {
    console.error("[studio-generate] ERROR", error);
    const message =
      error instanceof Error ? error.message : String(error);
    return jsonResponse(
      {
        ok: false,
        error: "GENERATION_FAILED",
        details: message,
      },
      { status: 500 },
    );
  }
});
