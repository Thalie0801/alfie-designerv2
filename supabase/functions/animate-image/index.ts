/**
 * animate-image - Génère une vraie vidéo animée via Replicate minimax/video-01-live
 * Coût : 10 Woofs (video_basic)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";

const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...(init ?? {}),
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[animate-image] 🚀 REPLICATE AI VIDEO VERSION - v4.0");
    
    // 1️⃣ Vérifier si c'est un appel interne via x-internal-secret
    const internalSecret = req.headers.get("x-internal-secret") || req.headers.get("X-Internal-Secret");
    const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = await import("../_shared/env.ts");
    const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");
    const isInternalCall = internalSecret && INTERNAL_FN_SECRET && internalSecret === INTERNAL_FN_SECRET;

    // 2️⃣ Lire le body UNE SEULE FOIS
    const body = await req.json();

    let userId: string;
    let skipWoofs = false;

    if (isInternalCall) {
      userId = body.userId;
      skipWoofs = body.skipWoofs === true;
      if (!userId) {
        return jsonResponse({ error: "userId required for internal call" }, { status: 400 });
      }
      console.log(`[animate-image] ✅ Internal call for user: ${userId}`);
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Missing Authorization header" }, { status: 401 });
      }

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return jsonResponse({ error: "Server configuration error" }, { status: 500 });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("[animate-image] Authentication failed:", authError);
        return jsonResponse({ error: "Authentication required" }, { status: 401 });
      }

      userId = user.id;
      console.log(`[animate-image] ✅ Authenticated user: ${userId}`);
    }

    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : undefined;
    const animationPrompt = typeof body?.animationPrompt === "string" ? body.animationPrompt : "Smooth zoom in with subtle pan movement";
    const brandId = typeof body?.brandId === "string" ? body.brandId : undefined;
    const orderId = typeof body?.orderId === "string" ? body.orderId : undefined;
    const duration = typeof body?.duration === "number" ? body.duration : 5;

    console.log("[animate-image] Input parameters:", {
      imageUrl: imageUrl?.substring(0, 60) + '...',
      animationPrompt,
      brandId,
      orderId,
      duration,
    });

    if (!imageUrl) {
      return jsonResponse({ error: "Missing imageUrl" }, { status: 400 });
    }

    if (!brandId) {
      return jsonResponse({ error: "Missing brandId" }, { status: 400 });
    }

    // 3️⃣ Consommer les Woofs (video_basic = 10 Woofs)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    let remainingWoofs = 0;

    if (!skipWoofs) {
      console.log(`[animate-image] Checking ${WOOF_COSTS.video_basic} Woofs for brand ${brandId}`);
      
      const { data: woofsData, error: woofsError } = await adminClient.functions.invoke(
        "woofs-check-consume",
        {
          body: {
            brand_id: brandId,
            cost_woofs: WOOF_COSTS.video_basic,
            reason: "ai_video_animation",
            metadata: { 
              imageUrl,
              animationPrompt,
              duration
            },
          },
        }
      );

      if (woofsError || !woofsData?.ok) {
        const errorCode = woofsData?.error?.code || "QUOTA_ERROR";
        if (errorCode === "INSUFFICIENT_WOOFS") {
          console.error("[animate-image] Insufficient Woofs:", woofsData?.error);
          return jsonResponse({ 
            error: "INSUFFICIENT_WOOFS",
            message: woofsData?.error?.message || "Tu n'as plus assez de Woofs pour cette animation IA.",
            remaining: woofsData?.error?.remaining || 0,
            required: WOOF_COSTS.video_basic
          }, { status: 402 });
        }
        console.error("[animate-image] Woofs consumption failed:", woofsError);
        return jsonResponse({ error: 'Failed to consume Woofs' }, { status: 500 });
      }

      remainingWoofs = woofsData.data.remaining_woofs;
      console.log(`[animate-image] ✅ Consumed ${WOOF_COSTS.video_basic} Woofs, remaining: ${remainingWoofs}`);
    } else {
      console.log(`[animate-image] ⏭️ Skipping Woofs consumption (already consumed by pack)`);
    }

    // 4️⃣ Appeler Replicate minimax/video-01-live
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN not configured");
    }

    console.log("[animate-image] 🎬 Calling Replicate minimax/video-01-live...");

    const replicateResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "4bce7c1730a5fc582699fb7e630c2e39c3dd4ddb11ca87fa3b7f0fc52537dd09",
        input: {
          image: imageUrl,
          prompt: animationPrompt,
          num_inference_steps: 50,
        }
      })
    });

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      console.error("[animate-image] Replicate API error:", errorText);
      return jsonResponse({ 
        error: "Replicate API failed", 
        details: errorText 
      }, { status: 500 });
    }

    const prediction = await replicateResponse.json();
    console.log("[animate-image] Replicate prediction started:", prediction.id);

    // 5️⃣ Polling pour attendre la vidéo générée
    let videoUrl = null;
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes max (5s * 60)

    while (pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5s
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
          }
        }
      );

      if (!statusResponse.ok) {
        console.error("[animate-image] Status check failed");
        break;
      }

      const status = await statusResponse.json();
      console.log(`[animate-image] Poll ${pollCount + 1}: ${status.status}`);

      if (status.status === "succeeded") {
        videoUrl = status.output;
        console.log("[animate-image] ✅ Video generated:", videoUrl);
        break;
      } else if (status.status === "failed") {
        console.error("[animate-image] Generation failed:", status.error);
        return jsonResponse({
          error: "Video generation failed",
          details: status.error
        }, { status: 500 });
      }

      pollCount++;
    }

    if (!videoUrl) {
      return jsonResponse({
        error: "Video generation timeout",
        message: "La génération a pris trop de temps (5 min max)"
      }, { status: 408 });
    }

    return jsonResponse({
      success: true,
      videoUrl,
      thumbnailUrl: imageUrl,
      duration,
      woofsCost: skipWoofs ? 0 : WOOF_COSTS.video_basic,
      remainingWoofs,
      metadata: {
        animationType: 'replicate_ai',
        engine: 'minimax/video-01-live',
        animationPrompt,
        predictionId: prediction.id,
      }
    });

  } catch (error: any) {
    console.error("[animate-image] error:", error);
    return jsonResponse({ error: error?.message || "Internal server error" }, { status: 500 });
  }
});
