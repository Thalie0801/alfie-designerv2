import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StudioGenerateRequest {
  type: "image" | "carousel" | "video";
  prompt: string;
  brandId: string;
  aspectRatio: string;
  quantity?: number;
  duration?: number;
  slides?: number;
  inputMedia?: { type: "image" | "video"; url: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as StudioGenerateRequest;

    if (!body.brandId || !body.prompt || !body.type) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields: type, prompt, brandId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[studio-generate] ${body.type} request from user ${user.id}`);

    // Route to appropriate generation function based on type
    let resourceId: string | null = null;
    let resourceType: "media" | "order" = "media";

    const referenceImage = body.inputMedia?.find((media) => media.type === "image");
    const referenceVideo = body.inputMedia?.find((media) => media.type === "video");

    if (body.type === "image") {
      const resolution =
        body.aspectRatio === "1:1"
          ? "1080x1080"
          : body.aspectRatio === "9:16"
            ? "1080x1920"
            : "1080x1350";

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

      const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-render-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": INTERNAL_FN_SECRET,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        const details =
          typeof result?.error === "string"
            ? result.error
            : typeof result?.code === "string"
              ? result.code
              : "GENERATION_FAILED";
        console.error("[studio-generate] alfie-render-image failed", {
          type: body.type,
          error: details,
        });
        throw new Error(details);
      }

      const result = await response.json();
      const mediaId =
        typeof result.mediaId === "string"
          ? result.mediaId
          : typeof result.id === "string"
            ? result.id
            : null;

      if (!mediaId) {
        throw new Error("alfie-render-image did not return a media identifier");
      }

      resourceId = mediaId;
      resourceType = "media";
    } else if (body.type === "carousel") {
      const generationId =
        typeof result.data?.generation_id === "string"
          ? result.data.generation_id
          : typeof result.data?.id === "string"
            ? result.data.id
            : null;

      if (!generationId) {
        console.error("[studio-generate] Missing generation_id in alfie-render-image response", {
          data: result.data,
        });
        throw new Error("GENERATION_ID_MISSING");
      }

      resourceId = generationId;
      resourceType = "media";
    } else if (body.type === "carousel") {
      const carouselBody = {
        userId: user.id,
        intent: {
          brandId: body.brandId,
          format: "carousel" as const,
          count: body.quantity && body.quantity > 0 ? body.quantity : 1,
          topic: body.prompt,
          ratio: body.aspectRatio === "4:5" ? "4:5" : body.aspectRatio === "9:16" ? "9:16" : "1:1",
        },
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-media`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(carouselBody),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        const details =
          typeof result?.message === "string"
            ? result.message
            : typeof result?.error === "string"
              ? result.error
              : "GENERATION_FAILED";
        console.error("[studio-generate] generate-media failed", {
          type: body.type,
          error: details,
        });
        throw new Error(details);
      }

      const orderId =
        typeof result.data?.orderId === "string" && result.data.orderId.length > 0
          ? result.data.orderId
          : null;

      if (!orderId) {
        console.error("[studio-generate] Missing orderId from generate-media", {
          data: result.data,
        });
        throw new Error("ORDER_ID_MISSING");
      }

      resourceId = orderId;
      resourceType = "order";
    } else {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-orchestrator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          message: body.prompt,
          user_message: body.prompt,
          brandId: body.brandId,
          forceTool: "generate_video",
          aspectRatio: body.aspectRatio,
          durationSec: body.duration ?? 12,
          uploadedSourceUrl: referenceVideo?.url ?? referenceImage?.url ?? null,
          uploadedSourceType: referenceVideo?.type ?? referenceImage?.type ?? null,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.error) {
        const details =
          typeof result?.error === "string"
            ? result.error
            : typeof result?.message === "string"
              ? result.message
              : "GENERATION_FAILED";
        console.error("[studio-generate] alfie-orchestrator failed", {
          type: body.type,
          error: details,
        });
        throw new Error(details);
      }

      const result = await response.json();
      const orderId = typeof result.orderId === "string" ? result.orderId : null;

      if (!orderId) {
        throw new Error("generate-media did not return an orderId");
      }

      resourceId = orderId;
      resourceType = "order";
    } else if (body.type === "video") {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/alfie-orchestrator`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: body.prompt,
          user_message: body.prompt,
          brandId: body.brandId,
          forceTool: "generate_video",
          aspectRatio: body.aspectRatio,
          durationSec: body.duration,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[studio-generate] alfie-orchestrator failed:", errorText);

        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Insufficient quota or credits" }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        throw new Error(`alfie-orchestrator failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      const orderId = typeof result.orderId === "string" ? result.orderId : null;

      if (!orderId) {
        throw new Error("alfie-orchestrator did not return an orderId");
      const orderId =
        typeof result?.orderId === "string" && result.orderId.length > 0
          ? result.orderId
          : null;

      if (!orderId) {
        console.error("[studio-generate] Missing orderId from alfie-orchestrator", {
          data: result,
        });
        throw new Error("ORDER_ID_MISSING");
      }

      resourceId = orderId;
      resourceType = "order";
    } else {
      throw new Error(`Unsupported type: ${body.type}`);
    }

    if (!resourceId) {
      throw new Error("Missing resourceId from generation response");
    }

    if (!resourceId) {
      throw new Error("RESOURCE_ID_MISSING");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        resourceId,
        type: resourceType,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[studio-generate] ERROR", error);
    return new Response(
      JSON.stringify({
        ok: false,
        code: "GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
        error: "GENERATION_FAILED",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
