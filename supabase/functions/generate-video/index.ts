import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const REPLICATE_API = "https://api.replicate.com/v1/predictions";
const DEFAULT_REPLICATE_MODEL_VERSION = "minimax/video-01"; // Remplace par le hash/slug exact
const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const KIE_TOKEN = Deno.env.get("KIE_API_KEY");
const REPLICATE_MODEL_VERSION =
  Deno.env.get("REPLICATE_VIDEO_MODEL_VERSION") ?? DEFAULT_REPLICATE_MODEL_VERSION;

const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...(init ?? {}),
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      prompt,
      aspectRatio = "16:9",
      imageUrl,
      provider = "replicate",
      publicBaseUrl
    } = body ?? {};

    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "Missing prompt" }, { status: 400 });
    }

    if (provider === "replicate") {
      if (!REPLICATE_TOKEN) {
        throw new Error("Missing REPLICATE_API_TOKEN");
      }

      const rawBaseUrl: string | undefined = publicBaseUrl ?? Deno.env.get("PUBLIC_BASE_URL") ?? undefined;
      const sanitizedBase = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : undefined;
      const webhookUrl = sanitizedBase ? `${sanitizedBase}/functions/v1/video-webhook` : undefined;

      const response = await fetch(REPLICATE_API, {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=60"
        },
        body: JSON.stringify({
          version: REPLICATE_MODEL_VERSION,
          input: {
            prompt,
            aspect_ratio: aspectRatio,
            image: imageUrl || undefined
          },
          webhook: webhookUrl,
          webhook_events_filter: ["completed", "failed"]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : "Replicate error";
        return jsonResponse({ error: detail }, { status: 500 });
      }

      const id = data.id ?? data.prediction?.id ?? null;
      const status: string = data.status ?? "processing";

      return jsonResponse({
        id,
        provider: "replicate",
        jobId: id,
        jobShortId: id ? String(id).slice(0, 8) : null,
        status,
        metadata: {
          provider: "replicate",
          modelVersion: REPLICATE_MODEL_VERSION
        }
      });
    }

    if (provider === "kling") {
      if (!KIE_TOKEN) {
        throw new Error("Missing KIE_API_KEY");
      }

      const response = await fetch("https://api.kie.ai/v2-1/kling/text-to-video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          resolution: aspectRatio === "9:16" ? "1080x1920" : "1920x1080",
          duration: 6,
          image_url: imageUrl || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const message = typeof data?.message === "string" ? data.message : "Kling error";
        return jsonResponse({ error: message }, { status: 500 });
      }

      const jobId = data.jobId ?? data.id ?? data.task_id ?? null;
      return jsonResponse({
        id: jobId,
        provider: "kling",
        jobId,
        jobShortId: jobId ? String(jobId).slice(0, 8) : null,
        status: "processing",
        metadata: { provider: "kling" }
      });
    }

    return jsonResponse({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    console.error("generate-video error", error);
    const message = error instanceof Error ? error.message : "Server error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
