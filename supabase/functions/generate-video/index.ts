import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken } from "../_shared/vertexAuth.ts";
const REPLICATE_API = "https://api.replicate.com/v1/predictions";
// ✅ Image-to-video optimisé : Stable Video Diffusion
const DEFAULT_REPLICATE_MODEL = "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438";
const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const KIE_TOKEN = Deno.env.get("KIE_API_KEY");
const REPLICATE_MODEL_VERSION = Deno.env.get("REPLICATE_VIDEO_MODEL_VERSION") ?? DEFAULT_REPLICATE_MODEL;
const DEFAULT_FFMPEG_BACKEND_URL = "https://alfie-ffmpeg-backend.onrender.com";

// ✅ Configuration optimisée pour vidéos image-to-video
const VIDEO_CONFIG = {
  fps: 10,
  num_frames: 50, // 5 secondes à 10fps
  motion_bucket_id: 40, // Mouvement léger (0-255)
  noise_aug_strength: 0.5, // Stabilité visuelle (0.4-0.6 recommandé)
  width: 720,
  height: 1280, // Format vertical
};

const DEFAULT_MOTION_PROMPT = "subtle, smooth camera movement, professional marketing, no distortions, no glitches";

const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...(init ?? {}),
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });

const MEDIA_URL_KEYS = [
  "videoUrl",
  "video_url",
  "url",
  "output",
  "outputUrl",
  "output_url",
  "downloadUrl",
  "download_url",
  "resultUrl",
  "result_url",
  "fileUrl",
  "file_url"
] as const;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const extractMediaUrl = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.startsWith("http") ? trimmed : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const extracted = extractMediaUrl(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (isRecord(payload)) {
    for (const key of MEDIA_URL_KEYS) {
      if (key in payload) {
        const extracted = extractMediaUrl(payload[key]);
        if (extracted) return extracted;
      }
    }

    if ("data" in payload) {
      const extracted = extractMediaUrl(payload.data);
      if (extracted) return extracted;
    }

    if ("result" in payload) {
      const extracted = extractMediaUrl((payload as UnknownRecord).result);
      if (extracted) return extracted;
    }
  }

  return null;
};

const collectStatusUrls = (payload: unknown): string[] => {
  if (!isRecord(payload)) return [];

  const urls = new Set<string>();
  const append = (value: unknown) => {
    if (typeof value === "string" && value.trim().startsWith("http")) {
      urls.add(value.trim());
    }
  };

  const statusFields = [
    "statusUrl",
    "status_url",
    "pollUrl",
    "poll_url",
    "resultUrl",
    "result_url",
    "progressUrl",
    "progress_url"
  ];

  for (const field of statusFields) {
    if (field in payload) {
      append(payload[field]);
    }
  }

  const listFields = ["statusUrls", "status_urls"];
  for (const field of listFields) {
    const candidate = payload[field];
    if (Array.isArray(candidate)) {
      for (const item of candidate) append(item);
    }
  }

  return Array.from(urls);
};

const readStatusString = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const statusValue = payload.status ?? payload.state;
  return typeof statusValue === "string" ? statusValue : null;
};

const getBackendBaseUrl = () => {
  const configured = Deno.env.get("FFMPEG_BACKEND_URL") ?? DEFAULT_FFMPEG_BACKEND_URL;
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

type ProviderResolution = {
  display: string;
  api: string;
  engine?: "sora" | "seededance" | "kling";
};

const resolveProvider = (raw?: string): ProviderResolution => {
  const normalized = (raw ?? "replicate").toLowerCase();

  if (normalized === "replicate" || normalized === "seededance") {
    return { display: "seededance", api: "replicate", engine: "seededance" };
  }

  if (normalized === "sora") {
    return { display: "sora", api: "kling", engine: "sora" };
  }

  if (normalized === "kling") {
    return { display: "kling", api: "kling", engine: "kling" };
  }

  if (normalized === "animate" || normalized === "ffmpeg-backend") {
    return { display: "animate", api: "animate" };
  }

  // ✅ VEO 3 FAST pour vidéos premium
  if (normalized === "veo3" || normalized === "veo_3_1" || normalized === "veo") {
    return { display: "veo3", api: "veo3" };
  }

  return { display: normalized, api: normalized };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_FN_SECRET } = await import("../_shared/env.ts");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Server configuration error" }, { status: 500 });
    }

    // Parse body once
    const body = await req.json();

    // ✅ Support authentication via internal secret (for job worker calls) or JWT (for direct calls)
    const internalSecret = req.headers.get("x-internal-secret") || req.headers.get("X-Internal-Secret");
    const isInternalCall = internalSecret && internalSecret === INTERNAL_FN_SECRET;
    
    let userId: string;
    let supabase;
    
    if (isInternalCall) {
      // Internal call from job worker - get userId from body
      userId = body.userId;
      if (!userId) {
        return jsonResponse({ error: "Missing userId in internal call" }, { status: 400 });
      }
      console.log(`[generate-video] ✅ Internal call authenticated for user: ${userId}`);
      
      // Use service role client for internal calls
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    } else {
      // External call - verify JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Missing Authorization header" }, { status: 401 });
      }

      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("[generate-video] Authentication failed:", authError);
        return jsonResponse({ error: "Authentication required" }, { status: 401 });
      }

      userId = user.id;
      console.log(`[generate-video] ✅ Authenticated user: ${userId}`);
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt : undefined;
    const aspectRatio = typeof body?.aspectRatio === "string" ? body.aspectRatio : "16:9";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : undefined;
    const publicBaseUrl = typeof body?.publicBaseUrl === "string" ? body.publicBaseUrl : undefined;
    const generationId = typeof body?.generationId === "string" ? body.generationId : undefined;
    const jobId = typeof body?.jobId === "string" ? body.jobId : undefined;
    const orderId = typeof body?.orderId === "string" ? body.orderId : undefined;

    const providerRaw = typeof body?.provider === "string" ? body.provider : undefined;
    const providerResolution = resolveProvider(providerRaw);
    const providerDisplay = providerResolution.display;
    const providerApi = providerResolution.api;
    const providerEngine = providerResolution.engine;
    const provider = (providerRaw ?? "replicate").toLowerCase();
    const normalizedProvider = provider === "sora" ? "kling" : provider;

    const isStatusCheck = !!(generationId || jobId) && !prompt;

    // Récupérer le brand_id actif pour les quotas
    let brandId: string | null = null;
    if (!isStatusCheck) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_brand_id')
        .eq('id', userId)
        .maybeSingle();
      
      brandId = profile?.active_brand_id || null;
    }

    if (!isStatusCheck && (!prompt || typeof prompt !== "string")) {
      return jsonResponse({ error: "Missing prompt" }, { status: 400 });
    }

    // ✅ VALIDATION BACKEND : Replicate image-to-video requiert une image source
    if (!isStatusCheck && normalizedProvider === "replicate" && !imageUrl) {
      console.error("[generate-video] No image provided for Replicate image-to-video");
      return jsonResponse({ 
        error: "Replicate requires an input image. Please provide imageUrl.",
        code: "MISSING_IMAGE"
      }, { status: 400 });
    }

    // Vérifier et consommer les Woofs pour les nouvelles générations (pas pour les status checks)
    if (!isStatusCheck && brandId) {
      const isPremium = providerEngine === "sora" || provider === "veo" || provider === "veo3" || provider === "premium";
      const woofsCost = isPremium ? WOOF_COSTS.video_premium : WOOF_COSTS.video_basic;
      
      console.log(`[generate-video] Checking ${woofsCost} Woofs for ${isPremium ? 'premium' : 'basic'} video (brand ${brandId})`);
      
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
      const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");
      
      const { data: woofsData, error: woofsError } = await adminClient.functions.invoke(
        "woofs-check-consume",
        {
          headers: {
            "x-internal-secret": INTERNAL_FN_SECRET!,
          },
          body: {
            userId,  // ✅ Passer userId pour appel interne
            brand_id: brandId,
            cost_woofs: woofsCost,
            reason: isPremium ? "video_premium" : "video_basic",
            metadata: { 
              prompt: prompt?.substring(0, 100),
              provider: providerDisplay,
              engine: providerEngine
            },
          },
        }
      );

      if (woofsError || !woofsData?.ok) {
        const errorCode = woofsData?.error?.code || "QUOTA_ERROR";
        if (errorCode === "INSUFFICIENT_WOOFS") {
          console.error("[generate-video] Insufficient Woofs:", woofsData?.error);
          return jsonResponse({ 
            error: "INSUFFICIENT_WOOFS",
            message: woofsData?.error?.message || "Tu n'as plus assez de Woofs pour cette génération.",
            remaining: woofsData?.error?.remaining || 0,
            required: woofsCost
          }, { status: 402 });
        }
        console.error("[generate-video] Woofs consumption failed:", woofsError);
        return jsonResponse({ error: 'Failed to consume Woofs' }, { status: 500 });
      }

      console.log(`[generate-video] ✅ Consumed ${woofsCost} Woofs, remaining: ${woofsData.data.remaining_woofs}`);
    }

    if (isStatusCheck) {
      const lookupId = generationId ?? jobId;
      if (!lookupId) {
        return jsonResponse({ error: "Missing generationId" }, { status: 400 });
      }

      if (normalizedProvider === "replicate") {
        if (!REPLICATE_TOKEN) {
          throw new Error("Missing REPLICATE_API_TOKEN");
        }

        const response = await fetch(`${REPLICATE_API}/${lookupId}`, {
          headers: {
            Authorization: `Token ${REPLICATE_TOKEN}`,
            "Content-Type": "application/json"
          }
        });

        const data = await response.json();
        if (!response.ok) {
          const detail = typeof data?.detail === "string" ? data.detail : "Replicate error";
          return jsonResponse({ error: detail }, { status: 500 });
        }

        return jsonResponse({
          id: data.id ?? lookupId,
          provider: providerDisplay,
          providerInternal: providerApi,
          providerEngine,
          status: data.status ?? data.state ?? "processing",
          output: data.output ?? null,
          logs: data.logs ?? undefined,
          error: data.error ?? undefined
        });
      }

      if (normalizedProvider === "kling") {
        if (!KIE_TOKEN) {
          throw new Error("Missing KIE_API_KEY");
        }

        const response = await fetch(`https://api.kie.ai/v1/video/${lookupId}`, {
          headers: {
            Authorization: `Bearer ${KIE_TOKEN}`,
            "Content-Type": "application/json"
          }
        });

        const data = await response.json();
        if (!response.ok) {
          const message = typeof data?.message === "string" ? data.message : "Kling error";
          return jsonResponse({ error: message }, { status: 500 });
        }

        const output = Array.isArray(data?.output)
          ? data.output[0]
          : data?.output ?? data?.video_url ?? data?.url ?? null;

        return jsonResponse({
          id: data?.id ?? lookupId,
          provider: providerDisplay,
          providerInternal: providerApi,
          providerEngine,
          status: data?.status ?? data?.state ?? "processing",
          output,
          metadata: data
        });
      }

      if (providerApi === "animate") {
        const baseUrl = getBackendBaseUrl();
        const endpoints = [
          `${baseUrl}/api/jobs/${lookupId}`,
          `${baseUrl}/api/status/${lookupId}`,
          `${baseUrl}/jobs/${lookupId}`,
          `${baseUrl}/status/${lookupId}`
        ];

        let lastError: { status: number; payload: unknown } | null = null;

        for (const url of endpoints) {
          const response = await fetch(url, { headers: buildBackendHeaders() });
          const text = await response.text();
          let parsed: unknown = undefined;

          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch (_) {
              parsed = text;
            }
          }

          if (response.status === 404) {
            continue;
          }

          if (response.ok) {
            const output = extractMediaUrl(parsed);
            const statusString = readStatusString(parsed) ?? (output ? "succeeded" : "processing");
            const statusUrls = collectStatusUrls(parsed);

            return jsonResponse({
              id: lookupId,
              provider: providerDisplay,
              providerInternal: providerApi,
              providerEngine,
              status: statusString,
              output,
              metadata: isRecord(parsed) ? parsed : undefined,
              statusUrls: statusUrls.length ? statusUrls : undefined
            });
          }

          lastError = { status: response.status, payload: parsed };
          break;
        }

        if (lastError) {
          return jsonResponse(
            {
              error: "Animate backend error",
              details: lastError.payload
            },
            { status: lastError.status }
          );
        }

        return jsonResponse({ error: "Animate job not found" }, { status: 404 });
      }

      return jsonResponse({ error: "Unknown provider" }, { status: 400 });
    }

    // ✅ Replicate video generation
    if (normalizedProvider === "replicate") {
      if (!REPLICATE_TOKEN) {
        throw new Error("Missing REPLICATE_API_TOKEN");
      }

      const rawBaseUrl: string | undefined = publicBaseUrl ?? Deno.env.get("PUBLIC_BASE_URL") ?? undefined;
      const sanitizedBase = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : undefined;
      const webhookUrl = sanitizedBase ? `${sanitizedBase}/functions/v1/video-webhook` : undefined;

      // ✅ Prioriser image-to-video
      const input = imageUrl 
        ? { 
            input_image: imageUrl, 
            ...VIDEO_CONFIG 
          }
        : { 
            prompt: `${prompt}. ${DEFAULT_MOTION_PROMPT}`, 
            ...VIDEO_CONFIG 
          };

      console.log("[generate-video] Replicate input:", { hasImage: !!imageUrl, config: VIDEO_CONFIG });

      const response = await fetch(REPLICATE_API, {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=60"
        },
        body: JSON.stringify({
          version: REPLICATE_MODEL_VERSION,
          input,
          // ✅ N'inclure webhook que si défini (évite l'erreur webhook_events_filter sans webhook)
          ...(webhookUrl && {
            webhook: webhookUrl,
            webhook_events_filter: ["completed", "failed"]
          })
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : "Replicate error";
        return jsonResponse({ error: detail }, { status: 500 });
      }

      const predictionId = data.id ?? data.prediction?.id ?? null;
      if (!predictionId) {
        return jsonResponse({ error: "No prediction ID returned from Replicate" }, { status: 500 });
      }

      // ✅ Polling: attendre que la vidéo soit prête
      let currentStatus: string = data.status ?? "processing";
      let output: any = data.output ?? null;
      
      const maxWaitMs = 300_000; // 5 minutes max
      const pollIntervalMs = 5000; // Vérifier toutes les 5 secondes
      const startTime = Date.now();

      console.log(`[generate-video] Starting polling for prediction ${predictionId}`);

      while (["starting", "processing"].includes(currentStatus) && (Date.now() - startTime) < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        
        const pollResp = await fetch(`${REPLICATE_API}/${predictionId}`, {
          headers: {
            Authorization: `Token ${REPLICATE_TOKEN}`,
            "Content-Type": "application/json"
          }
        });
        
        if (pollResp.ok) {
          const pollData = await pollResp.json();
          currentStatus = pollData.status ?? "processing";
          output = pollData.output ?? null;
          
          console.log(`[generate-video] Poll status: ${currentStatus}, has output: ${!!output}`);
          
          if (currentStatus === "succeeded" && output) {
            console.log(`[generate-video] ✅ Video ready after ${Math.round((Date.now() - startTime) / 1000)}s`);
            break;
          }
          
          if (currentStatus === "failed" || currentStatus === "canceled") {
            const errorMsg = pollData.error || `Generation ${currentStatus}`;
            console.error(`[generate-video] Generation failed:`, errorMsg);
            return jsonResponse({ 
              error: errorMsg,
              status: currentStatus,
              predictionId
            }, { status: 500 });
          }
        } else {
          console.warn(`[generate-video] Poll request failed with status ${pollResp.status}`);
        }
      }

      // Timeout si toujours en processing
      if (["starting", "processing"].includes(currentStatus)) {
        console.warn(`[generate-video] Timeout after ${maxWaitMs / 1000}s, status: ${currentStatus}`);
        return jsonResponse({
          error: "Video generation timeout. Please try again.",
          status: currentStatus,
          predictionId
        }, { status: 504 });
      }

      // Extraire l'URL de sortie
      const outputUrl = Array.isArray(output) ? output[0] : output;
      
      if (!outputUrl || typeof outputUrl !== "string") {
        console.error(`[generate-video] No valid output URL:`, output);
        return jsonResponse({
          error: "No video URL in output",
          status: currentStatus,
          predictionId
        }, { status: 500 });
      }

      console.log(`[generate-video] Final output URL:`, outputUrl);
      
      const id = predictionId;
      const status: string = currentStatus;

      // Save to media_generations for library
      const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
      if (authHeader && id) {
        try {
          if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            const { data: { user } } = await supabase.auth.getUser(authHeader);
            
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('active_brand_id')
                .eq('id', user.id)
                .maybeSingle();

              const brandId = profile?.active_brand_id;
              if (!brandId) {
                console.warn('[generate-video] No active brand for user', user.id);
              }
              
              await supabase
                .from('media_generations')
                .insert({
                  user_id: user.id,
                  brand_id: brandId!,
                  type: 'video',
                  engine: providerEngine || 'seededance',
                  status: 'completed', // ✅ Status completed car polling a attendu
                  prompt: prompt.substring(0, 500),
                  output_url: outputUrl, // ✅ URL réelle après polling
                  thumbnail_url: outputUrl, // Utiliser la même URL comme thumbnail
                  job_id: id,
                  metadata: {
                    provider: providerDisplay,
                    providerInternal: providerApi,
                    predictionId: id,
                    aspectRatio,
                    generatedAt: new Date().toISOString(),
                    tier: 'standard',
                    source: imageUrl ? 'image' : 'text',
                    duration: 3,
                    fps: VIDEO_CONFIG.fps,
                    resolution: `${VIDEO_CONFIG.width}x${VIDEO_CONFIG.height}`
                  }
                });
              console.log(`[generate-video] ✅ Video entry created for job ${id} with URL:`, outputUrl);
            }
          }
        } catch (insertError) {
          console.error('[generate-video] Failed to create media_generations entry:', insertError);
        }
      }

      return jsonResponse({
        id,
        provider: providerDisplay,
        providerInternal: providerApi,
        providerEngine,
        jobId: id,
        jobShortId: id ? String(id).slice(0, 8) : null,
        status,
        output: outputUrl,
        videoUrl: outputUrl,
        url: outputUrl,
        metadata: {
          provider: providerDisplay,
          providerInternal: providerApi,
          modelVersion: REPLICATE_MODEL_VERSION,
          outputUrl: outputUrl
        }
      });
    }

    // ✅ VEO 3 FAST premium video generation
    if (providerApi === "veo3") {
      const projectId = Deno.env.get("VERTEX_PROJECT_ID");
      // ✅ CRITICAL: VEO 3 is ONLY available in us-central1, force it
      const location = "us-central1";
      const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
      const videosBucket = Deno.env.get("VERTEX_VIDEOS_BUCKET") || "alfie-designer-videos";

      if (!projectId || !serviceAccountJson) {
        return jsonResponse({ 
          error: "Vertex AI VEO 3 not configured. Missing VERTEX_PROJECT_ID or GOOGLE_SERVICE_ACCOUNT_JSON." 
        }, { status: 500 });
      }

      if (!videosBucket) {
        return jsonResponse({ 
          error: "VERTEX_VIDEOS_BUCKET not configured" 
        }, { status: 500 });
      }

      console.log(`[generate-video] VEO 3 storage bucket: ${videosBucket}`);

      console.log("[generate-video] 🎬 Using VEO 3 FAST for premium video");

      // 1. Générer access token via Service Account
      const accessToken = await getAccessToken(serviceAccountJson);

      // 2. Configuration VEO 3
      const VEO3_MODEL = "veo-3.0-fast-generate-001";
      const veo3AspectRatio = aspectRatio === "4:5" ? "9:16" : aspectRatio; // VEO supporte 9:16 ou 16:9
      const durationSeconds = 8; // Vidéos premium : 8 secondes max (VEO 3 supporte 4, 6, ou 8)
      
      // 3. Appeler VEO 3 API (long-running operation)
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${VEO3_MODEL}:predictLongRunning`;

      const veoPayload = {
        instances: [{ prompt }],
        parameters: {
          aspectRatio: veo3AspectRatio,
          durationSeconds,
          generateAudio: true,
          storageUri: orderId ? `gs://${videosBucket}/veo3/${orderId}/` : `gs://${videosBucket}/veo3/`
        }
      };

      console.log("[generate-video] VEO 3 payload:", JSON.stringify(veoPayload, null, 2));

      const veoResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(veoPayload)
      });

      if (!veoResponse.ok) {
        const errorText = await veoResponse.text();
        console.error("[generate-video] VEO 3 error:", errorText);
        return jsonResponse({ 
          error: `VEO 3 API error: ${veoResponse.status}`,
          details: errorText 
        }, { status: 500 });
      }

      const operation = await veoResponse.json();
      const operationName = operation.name;
      
      if (!operationName) {
        return jsonResponse({ 
          error: "No operation name returned from VEO 3" 
        }, { status: 500 });
      }

      console.log(`[generate-video] VEO 3 operation started: ${operationName}`);

      // Extraire la région depuis l'operationName pour le polling
      // Format: projects/{project}/locations/{location}/publishers/...
      const locationMatch = operationName.match(/locations\/([^\/]+)\//);
      const operationLocation = locationMatch ? locationMatch[1] : location;
      console.log(`[generate-video] VEO 3 operation location: ${operationLocation}`);

      // 4. Polling de l'opération (VEO 3 FAST est rapide: 30-60 secondes)
      const maxWaitMs = 300_000; // 5 minutes max
      const pollIntervalMs = 10000; // Vérifier toutes les 10 secondes
      const startTime = Date.now();
      
      let result: any = null;
      let isDone = false;

      while (!isDone && (Date.now() - startTime) < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        
        // ✅ VEO 3 requires POST to fetchPredictOperation endpoint
        const modelEndpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${VEO3_MODEL}`;
        const fetchOperationUrl = `https://${location}-aiplatform.googleapis.com/v1/${modelEndpoint}:fetchPredictOperation`;
        
        console.log(`[generate-video] VEO 3 fetchPredictOperation URL: ${fetchOperationUrl}`);
        
        const statusResp = await fetch(fetchOperationUrl, {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ operationName })
        });

        console.log(`[generate-video] VEO 3 poll status: ${statusResp.status}`);
        if (!statusResp.ok) {
          const errorBody = await statusResp.text().catch(() => 'unable to read body');
          console.warn(`[generate-video] VEO 3 poll failed: ${statusResp.status}`, {
            url: fetchOperationUrl,
            location,
            operationName: operationName.slice(0, 50),
            errorBody: errorBody.slice(0, 200)
          });
          continue;
        }

        result = await statusResp.json();
        isDone = result.done === true;

        console.log(`[generate-video] VEO 3 poll: done=${isDone}, elapsed=${Math.round((Date.now() - startTime) / 1000)}s`);
        
        if (isDone) {
          console.log("[generate-video] VEO 3 full result:", JSON.stringify(result, null, 2));
          break;
        }
      }

      // Timeout si toujours en processing
      if (!isDone) {
        console.warn(`[generate-video] VEO 3 timeout after ${maxWaitMs / 1000}s`);
        return jsonResponse({
          error: "VEO 3 generation timeout. Please try again.",
          operationName
        }, { status: 504 });
      }

      // 5. Extraire l'URL vidéo (tous les formats VEO 3)
      const videoUri = 
        result?.response?.generatedVideos?.[0]?.video?.uri ||   // Format SDK
        result?.response?.videos?.[0]?.gcsUri ||                // Format REST API doc
        result?.response?.generatedSamples?.[0]?.video?.uri;    // Fallback legacy
      
      if (!videoUri || typeof videoUri !== "string") {
        console.error(`[generate-video] No valid VEO 3 video URI. Full result:`, JSON.stringify(result, null, 2));
        return jsonResponse({
          error: "No video URI in VEO 3 response",
          response: result?.response
        }, { status: 500 });
      }

      console.log(`[generate-video] ✅ VEO 3 video ready (GCS): ${videoUri}`);

      // 6. Transférer la vidéo GCS → Cloudinary pour URL publique
      let cloudinaryUrl = videoUri; // Fallback si le transfert échoue
      let cloudinaryThumbnail = videoUri;
      
      try {
        console.log('[generate-video] Starting VEO 3 → Cloudinary transfer...');
        
        // Convertir gs://bucket/path → https://storage.googleapis.com/bucket/path
        const httpUrl = videoUri.replace('gs://', 'https://storage.googleapis.com/');
        console.log(`[generate-video] GCS HTTP URL: ${httpUrl}`);
        
        // Uploader vers Cloudinary via edge function
        const cloudinaryResp = await fetch(`${SUPABASE_URL}/functions/v1/cloudinary`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'upload',
            params: {
              file: httpUrl,
              folder: `alfie/veo3/${operationName}`,
              resource_type: 'video',
              public_id: `veo3_${Date.now()}`
            }
          })
        });

        if (cloudinaryResp.ok) {
          const cloudinaryData = await cloudinaryResp.json();
          cloudinaryUrl = cloudinaryData.secure_url || cloudinaryUrl;
          cloudinaryThumbnail = cloudinaryData.secure_url?.replace(/\.[^.]+$/, '.jpg') || cloudinaryUrl;
          console.log(`[generate-video] ✅ Video uploaded to Cloudinary: ${cloudinaryUrl}`);
        } else {
          const errorText = await cloudinaryResp.text().catch(() => 'unknown error');
          console.warn(`[generate-video] Cloudinary upload failed (${cloudinaryResp.status}), keeping GCS URL:`, errorText);
        }
      } catch (transferError) {
        console.error('[generate-video] VEO 3 → Cloudinary transfer error:', transferError);
        console.log('[generate-video] Falling back to GCS URL');
      }

      // 7. Save to media_generations for library
      const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
      if (authHeader && operationName) {
        try {
          if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            const { data: { user } } = await supabase.auth.getUser(authHeader);
            
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('active_brand_id')
                .eq('id', user.id)
                .maybeSingle();

              const brandId = profile?.active_brand_id;
              if (!brandId) {
                console.warn('[generate-video] No active brand for user', user.id);
              }
              
              await supabase
                .from('media_generations')
                .insert({
                  user_id: user.id,
                  brand_id: brandId!,
                  type: 'video',
                  engine: 'veo_3_1',
                  status: 'completed',
                  prompt: prompt.substring(0, 500),
                  output_url: cloudinaryUrl,
                  thumbnail_url: cloudinaryThumbnail,
                  job_id: operationName,
                  metadata: {
                    provider: 'veo3',
                    tier: 'premium',
                    source: 'text',
                    aspectRatio: veo3AspectRatio,
                    duration: durationSeconds,
                    generatedAt: new Date().toISOString(),
                    operationName,
                    originalGcsUrl: videoUri,
                    cloudinaryTransfer: cloudinaryUrl !== videoUri
                  }
                });
              console.log(`[generate-video] ✅ VEO 3 video entry created for operation ${operationName}`);
            }
          }
        } catch (insertError) {
          console.error('[generate-video] Failed to create media_generations entry:', insertError);
        }
      }

      return jsonResponse({
        id: operationName,
        provider: providerDisplay,
        providerInternal: providerApi,
        providerEngine: "veo3",
        jobId: operationName,
        status: "succeeded",
        output: cloudinaryUrl,
        videoUrl: cloudinaryUrl,
        url: cloudinaryUrl,
        metadata: {
          provider: "veo3",
          tier: "premium",
          aspectRatio: veo3AspectRatio,
          duration: durationSeconds,
          outputUrl: cloudinaryUrl,
          originalGcsUrl: videoUri,
          cloudinaryTransfer: cloudinaryUrl !== videoUri
        }
      });
    }

    if (normalizedProvider === "kling") {
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

      // Save to media_generations for library
      const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
      if (authHeader && jobId) {
        try {
          if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            const { data: { user } } = await supabase.auth.getUser(authHeader);
            
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('active_brand_id')
                .eq('id', user.id)
                .maybeSingle();

              const brandId = profile?.active_brand_id;
              if (!brandId) {
                console.warn('[generate-video] No active brand for user', user.id);
              }
              
              await supabase
                .from('media_generations')
                .insert({
                  user_id: user.id,
                  brand_id: brandId!,
                  type: 'video',
                  engine: providerEngine || 'kling',
                  status: 'processing',
                  prompt: prompt.substring(0, 500),
                  output_url: '',
                  thumbnail_url: '',
                  job_id: jobId,
                  metadata: {
                    provider: providerDisplay,
                    providerInternal: providerApi,
                    predictionId: jobId,
                    aspectRatio,
                    generatedAt: new Date().toISOString()
                  }
                });
              console.log(`[generate-video] Video entry created for job ${jobId}`);
            }
          }
        } catch (insertError) {
          console.error('[generate-video] Failed to create media_generations entry:', insertError);
        }
      }

      return jsonResponse({
        id: jobId,
        provider: providerDisplay,
        providerInternal: providerApi,
        providerEngine,
        jobId,
        jobShortId: jobId ? String(jobId).slice(0, 8) : null,
        status: "processing",
        metadata: { provider: providerDisplay, providerInternal: providerApi }
      });
    }

    if (providerApi === "animate") {
      const baseUrl = getBackendBaseUrl();
      const endpoints = [
        `${baseUrl}/api/generate`,
        `${baseUrl}/generate`,
        `${baseUrl}/v1/generate`
      ];

      const payload: UnknownRecord = {};
      if (isRecord(body)) {
        for (const [key, value] of Object.entries(body)) {
          if (["provider", "publicBaseUrl", "generationId", "jobId"].includes(key)) continue;
          payload[key] = value;
        }
      }

      if (prompt) payload.prompt = prompt;
      payload.aspectRatio = aspectRatio;
      if (imageUrl) payload.imageUrl = imageUrl;

      for (const url of endpoints) {
        const response = await fetch(url, {
          method: "POST",
          headers: buildBackendHeaders(),
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        let parsed: unknown = undefined;

        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch (_) {
            parsed = text;
          }
        }

        if (response.ok) {
          const output = extractMediaUrl(parsed);
          const statusString = readStatusString(parsed) ?? (output ? "succeeded" : "processing");
          const statusUrls = collectStatusUrls(parsed);
          const jobIdentifier =
            (isRecord(parsed) && typeof parsed.jobId === "string" && parsed.jobId) ||
            (isRecord(parsed) && typeof parsed.job_id === "string" && parsed.job_id) ||
            (isRecord(parsed) && typeof parsed.id === "string" && parsed.id) ||
            (isRecord(parsed) && typeof (parsed as UnknownRecord).taskId === "string" && (parsed as UnknownRecord).taskId) ||
            (isRecord(parsed) && typeof (parsed as UnknownRecord).task_id === "string" && (parsed as UnknownRecord).task_id) ||
            null;

          return jsonResponse({
            id: jobIdentifier,
            provider: providerDisplay,
            providerInternal: providerApi,
            providerEngine,
            jobId: jobIdentifier,
            jobShortId: jobIdentifier ? String(jobIdentifier).slice(0, 8) : null,
            status: statusString,
            output,
            statusUrls: statusUrls.length ? statusUrls : undefined,
            metadata: isRecord(parsed) ? parsed : undefined
          });
        }

        if (response.status !== 404) {
          const errorMessage =
            (isRecord(parsed) && typeof parsed.error === "string" && parsed.error) ||
            (typeof parsed === "string" && parsed) ||
            text ||
            `Animate backend error (${response.status})`;

          return jsonResponse(
            { error: errorMessage, status: response.status, raw: parsed ?? text },
            { status: response.status }
          );
        }
      }

      return jsonResponse({ error: "Animate backend unreachable" }, { status: 502 });
    }

    return jsonResponse({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    console.error("generate-video error", error);
    const message = error instanceof Error ? error.message : "Server error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
