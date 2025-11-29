/**
 * animate-image - Applique un effet Ken Burns (Cloudinary) sur une image
 * Coût : 3 Woofs
 * Deployed: 2025-01-30 - Force re-deploy to fix library_assets type
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
      // Appel interne - récupérer userId depuis le body
      userId = body.userId;
      skipWoofs = body.skipWoofs === true;
      if (!userId) {
        return jsonResponse({ error: "userId required for internal call" }, { status: 400 });
      }
      console.log(`[animate-image] ✅ Internal call for user: ${userId}`);
    } else {
      // Auth JWT standard
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
    const imagePublicId = typeof body?.imagePublicId === "string" ? body.imagePublicId : undefined;
    const cloudName = typeof body?.cloudName === "string" ? body.cloudName : Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const brandId = typeof body?.brandId === "string" ? body.brandId : undefined;
    const orderId = typeof body?.orderId === "string" ? body.orderId : undefined;
    const title = typeof body?.title === "string" ? body.title : undefined;
    const subtitle = typeof body?.subtitle === "string" ? body.subtitle : undefined;
    const duration = typeof body?.duration === "number" ? body.duration : 3;
    const aspect = typeof body?.aspect === "string" ? body.aspect : "4:5";

    if (!imagePublicId || !cloudName) {
      return jsonResponse({ error: "Missing imagePublicId or cloudName" }, { status: 400 });
    }

    if (!brandId) {
      return jsonResponse({ error: "Missing brandId" }, { status: 400 });
    }

    // 3️⃣ Conditionner la consommation de Woofs
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    let remainingWoofs = 0;

    if (!skipWoofs) {
      console.log(`[animate-image] Checking ${WOOF_COSTS.animated_image} Woofs for brand ${brandId}`);
      
      const { data: woofsData, error: woofsError } = await adminClient.functions.invoke(
        "woofs-check-consume",
        {
          body: {
            brand_id: brandId,
            cost_woofs: WOOF_COSTS.animated_image,
            reason: "animated_image",
            metadata: { 
              imagePublicId,
              duration,
              aspect
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
            message: woofsData?.error?.message || "Tu n'as plus assez de Woofs pour cette animation.",
            remaining: woofsData?.error?.remaining || 0,
            required: WOOF_COSTS.animated_image
          }, { status: 402 });
        }
        console.error("[animate-image] Woofs consumption failed:", woofsError);
        return jsonResponse({ error: 'Failed to consume Woofs' }, { status: 500 });
      }

      remainingWoofs = woofsData.data.remaining_woofs;
      console.log(`[animate-image] ✅ Consumed ${WOOF_COSTS.animated_image} Woofs, remaining: ${remainingWoofs}`);
    } else {
      console.log(`[animate-image] ⏭️ Skipping Woofs consumption (already consumed by pack)`);
    }

    // Générer l'URL Cloudinary avec effet Ken Burns
    const ASPECT_DIM: Record<string, string> = {
      '1:1':  'w_1080,h_1080',
      '16:9': 'w_1920,h_1080',
      '9:16': 'w_1080,h_1920',
      '4:3':  'w_1440,h_1080',
      '3:4':  'w_1080,h_1440',
      '4:5':  'w_1080,h_1350',
    };

    const dim = ASPECT_DIM[aspect] || ASPECT_DIM['4:5'];
    const kenBurns = `e_zoompan:duration_${duration};zoom_20,g_center`;

    const overlays: string[] = [];
    if (title) {
      const cleanTitle = title.substring(0, 80);
      overlays.push(`l_text:Arial_70_bold:${encodeURIComponent(cleanTitle)},co_rgb:FFFFFF,g_north,y_200`);
    }
    if (subtitle) {
      const cleanSubtitle = subtitle.substring(0, 100);
      overlays.push(`l_text:Arial_44:${encodeURIComponent(cleanSubtitle)},co_rgb:E5E7EB,g_center,y_50`);
    }

    const videoUrl = [
      `https://res.cloudinary.com/${cloudName}/video/upload`,
      `/${dim},c_fill,f_mp4,${kenBurns}`,
      overlays.length ? `/${overlays.join('/')}` : '',
      `/${imagePublicId}.mp4`
    ].join('');

    console.log("[animate-image] Generated video URL:", videoUrl);

    // 4️⃣ Utiliser adminClient pour les sauvegardes DB quand appel interne
    const dbClient = isInternalCall ? adminClient : createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } }
    });

    // Sauvegarder dans media_generations (type=video, engine=NULL pour Cloudinary)
    const { error: mediaError } = await dbClient
      .from('media_generations')
      .insert({
        user_id: userId,
        brand_id: brandId,
        type: 'video',
        engine: null, // Cloudinary Ken Burns n'est pas dans l'enum video_engine
        status: 'completed',
        output_url: videoUrl,
        thumbnail_url: `https://res.cloudinary.com/${cloudName}/image/upload/${imagePublicId}.jpg`,
        duration_seconds: duration,
        expires_at: null, // ✅ Vidéos Cloudinary permanentes - pas d'expiration
        metadata: {
          orderId,
          sourceImagePublicId: imagePublicId,
          aspect,
          title,
          subtitle,
          generatedAt: new Date().toISOString(),
          animationType: 'ken_burns',
          engine: 'cloudinary_kenburns' // Stocker ici pour référence
        },
      });

    if (mediaError) {
      console.error("[animate-image] Failed to save to media_generations:", mediaError);
    }

    // Sauvegarder dans library_assets (type=image car constraint accepte seulement image/carousel_slide)
    if (orderId) {
      const { error: libError } = await dbClient
        .from('library_assets')
        .insert({
          user_id: userId,
          brand_id: brandId,
          order_id: orderId,
          type: 'image', // ✅ Type autorisé dans library_assets constraint
          cloudinary_url: videoUrl,
          format: aspect,
          tags: ["animated_image", "ken_burns", "alfie", "video"],
          metadata: {
            sourceImagePublicId: imagePublicId,
            duration,
            aspect,
            title,
            subtitle,
            animationType: 'ken_burns',
            isAnimatedVideo: true // Flag pour différencier des images statiques
          },
        });

      if (libError) {
        console.error("[animate-image] Failed to save to library_assets:", libError);
      }
    }

    return jsonResponse({
      success: true,
      videoUrl,
      thumbnailUrl: `https://res.cloudinary.com/${cloudName}/image/upload/${imagePublicId}.jpg`,
      duration,
      woofsCost: skipWoofs ? 0 : WOOF_COSTS.animated_image,
      remainingWoofs
    });

  } catch (error: any) {
    console.error("[animate-image] error:", error);
    return jsonResponse({ error: error?.message || "Internal server error" }, { status: 500 });
  }
});
