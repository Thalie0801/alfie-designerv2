import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userHasAccess } from "../_shared/accessControl.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

const getBackendBaseUrl = () => {
  const configured = Deno.env.get("FFMPEG_BACKEND_URL") ?? "https://alfie-ffmpeg-backend.onrender.com";
  return configured.replace(/\/$/, "");
};

const buildBackendHeaders = () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = Deno.env.get("FFMPEG_BACKEND_API_KEY");
  const bearer = Deno.env.get("FFMPEG_BACKEND_BEARER") ?? Deno.env.get("FFMPEG_BACKEND_BEARER_TOKEN");
  const customHeaderName = Deno.env.get("FFMPEG_BACKEND_AUTH_HEADER");
  const customHeaderValue = Deno.env.get("FFMPEG_BACKEND_AUTH_VALUE");

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  if (bearer) {
    headers["Authorization"] = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  }

  if (customHeaderName && customHeaderValue) {
    headers[customHeaderName] = customHeaderValue;
  }

  return headers;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials are not configured");
    }

    const authHeader = req.headers.get("Authorization")?.replace("Bearer", "").trim();

    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader);

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`Video generation request from user: ${user.id}, email: ${user.email}`);

    // Vérifier l'accès (Stripe OU granted_by_admin)
    const hasAccess = await userHasAccess(req.headers.get("Authorization"));
    if (!hasAccess) {
      return jsonResponse({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const promptRaw = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const aspectRatio = typeof body?.aspectRatio === "string" && body.aspectRatio.trim()
      ? body.aspectRatio.trim()
      : "1:1";

    const source = typeof body?.source === "object" && body?.source !== null ? body.source : null;
    const brandKit = typeof body?.brandKit === "object" && body?.brandKit !== null ? body.brandKit : null;
    const slideIndex = typeof body?.slideIndex === "number" ? body.slideIndex : null;
    const totalSlides = typeof body?.totalSlides === "number" ? body.totalSlides : null;
    const duration = typeof body?.duration === "number" ? body.duration : null;
    const fps = typeof body?.fps === "number" ? body.fps : null;
    
    const payload: Record<string, unknown> = {
      aspectRatio,
    };

    if (promptRaw) {
      payload.prompt = promptRaw;
    }
    
    if (duration) payload.duration = duration;
    if (fps) payload.fps = fps;

    const sourceType = typeof source?.type === "string" ? source.type : null;
    const sourceUrl = typeof source?.url === "string" ? source.url : null;

    if (sourceType === "image" && sourceUrl) {
      payload.imageUrl = sourceUrl;
    }

    if (sourceType === "video" && sourceUrl) {
      payload.videoUrl = sourceUrl;
    }

    if (!payload.prompt && !payload.imageUrl && !payload.videoUrl) {
      return jsonResponse({ error: "Provide a prompt or a media source" }, { status: 400 });
    }

    payload.userId = user.id;
    payload.userEmail = user.email ?? null;

    // Try multiple endpoints in case backend path differs
    const baseUrl = getBackendBaseUrl();
    const endpoints = [
      `${baseUrl}/api/generate`,
      `${baseUrl}/generate`,
      `${baseUrl}/v1/generate`
    ];

    let backendResponse: Response | null = null;
    let rawText = '';
    let parsed: unknown = null;
    let lastStatus = 0;

    for (const url of endpoints) {
      console.log(`Attempting backend URL: ${url}`);
      const resp = await fetch(url, {
        method: "POST",
        headers: buildBackendHeaders(),
        body: JSON.stringify(payload),
      });
      lastStatus = resp.status;
      const text = await resp.text();
      rawText = text;
      parsed = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          console.warn("chat-generate-video: invalid JSON from backend", e);
        }
      }

      if (resp.ok) {
        backendResponse = resp;
        break;
      }

      // Retry next endpoint only on 404 (route not found)
      if (resp.status !== 404) {
        backendResponse = resp;
        break;
      }
    }

    if (!backendResponse) {
      return jsonResponse({ error: "Video backend unreachable" }, { status: 502 });
    }

    if (!backendResponse.ok) {
      const errorMessage =
        (parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as any).error === "string")
          ? (parsed as any).error
          : (typeof parsed === "string" && parsed)
          ? parsed
          : rawText || `Video backend error (${lastStatus})`;

      return jsonResponse({ error: errorMessage, status: lastStatus, raw: parsed ?? rawText }, {
        status: lastStatus,
      });
    }

    // Sauvegarder en bibliothèque (Phase 4)
    if (parsed && typeof parsed === "object" && "videoUrl" in parsed) {
      const videoUrl = (parsed as any).videoUrl || (parsed as any).url;
      
      if (videoUrl && typeof videoUrl === "string") {
        const brandId = typeof brandKit?.id === "string" ? brandKit.id : null;
        
        await supabase
          .from('media_generations')
          .insert({
            user_id: user.id,
            brand_id: brandId,
            type: 'video',
            engine: 'ffmpeg-backend',
            status: 'completed',
            prompt: (payload.prompt as string)?.substring(0, 500) || "",
            output_url: videoUrl,
            thumbnail_url: videoUrl,
            woofs: 2,
            duration_seconds: duration,
            metadata: {
              aspectRatio: payload.aspectRatio,
              fps: fps,
              brandName: brandKit?.name,
              slideIndex,
              totalSlides,
              generatedAt: new Date().toISOString()
            }
          })
          .select()
          .single();
        
        console.log(`Video saved to library for user ${user.id}`);
      }
    }
    
    if (parsed && typeof parsed === "object") {
      return jsonResponse(parsed);
    }

    if (rawText) {
      return jsonResponse({ message: rawText });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("chat-generate-video error", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
