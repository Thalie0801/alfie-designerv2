/**
 * Service pour envoyer un pack Alfie au générateur
 * Gère la vérification des Woofs et la création des orders/jobs
 */

import type { AlfiePack } from "@/types/alfiePack";
import { calculatePackWoofCost } from "@/lib/woofs";
import { supabase } from "@/integrations/supabase/client";

export class InsufficientWoofsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientWoofsError";
  }
}

export interface SendPackParams {
  brandId: string;
  pack: AlfiePack;
  userId: string;
  selectedAssetIds: string[];
  useBrandKit?: boolean;
  useLogo?: boolean; // ✅ NEW: Option logo
  userPlan?: string;
  carouselMode?: 'standard' | 'premium'; // ✅ Mode Standard/Premium pour carrousels
  colorMode?: 'vibrant' | 'pastel'; // ✅ Mode Coloré/Pastel
  visualStyle?: 'background' | 'character' | 'product'; // ✅ NEW: Style visuel adaptatif
}

export interface SendPackResult {
  success: boolean;
  orderIds: string[];
}

/**
 * Envoie un pack au générateur
 * 1. Calcule le coût total en Woofs
 * 2. Vérifie et consomme les Woofs via woofs-check-consume
 * 3. Crée les orders/jobs pour chaque asset sélectionné
 */
export async function sendPackToGenerator({
  brandId,
  pack,
  userId,
  selectedAssetIds,
  useBrandKit = true,
  useLogo = false, // ✅ NEW: Option logo
  userPlan = 'starter',
  carouselMode = 'standard', // ✅ Mode Standard/Premium pour carrousels
  colorMode = 'vibrant', // ✅ Mode Coloré/Pastel
  visualStyle = 'background', // ✅ NEW: Style visuel adaptatif
}: SendPackParams): Promise<SendPackResult> {
  // 1. Calculer le coût total Woofs
  const totalWoofs = calculatePackWoofCost(pack, selectedAssetIds);

  console.log(`[Pack] Coût total: ${totalWoofs} Woofs pour ${selectedAssetIds.length} assets`);

  // 2. Vérifier + consommer les Woofs via woofs-check-consume
  // ⚠️ APPELÉ UNIQUEMENT ICI, PAS PENDANT LE SIMPLE CHAT
  const quotaCheck = await supabase.functions.invoke("woofs-check-consume", {
    body: {
      brand_id: brandId,
      cost_woofs: totalWoofs,
      reason: "pack_from_chat",
      metadata: { 
        packTitle: pack.title, 
        assetsCount: selectedAssetIds.length,
        userId 
      },
    },
  });

  if (!quotaCheck.data?.ok) {
    const errorObj = quotaCheck.data?.error;
    const errorMessage = typeof errorObj === 'string' 
      ? errorObj 
      : errorObj?.message || "Quota verification failed";
    const errorCode = typeof errorObj === 'object' ? errorObj?.code : undefined;

    console.error("[Pack] Quota check failed:", { errorCode, errorMessage, errorObj });
    
    if (errorCode === "INSUFFICIENT_WOOFS" || 
        (typeof errorMessage === 'string' && errorMessage.includes("quota"))) {
      throw new InsufficientWoofsError(
        `Il te reste moins de ${totalWoofs} Woofs. Ce pack en coûte ${totalWoofs}.`
      );
    }
    
    throw new Error(errorMessage);
  }

  console.log(`[Pack] Quota OK, remaining Woofs: ${quotaCheck.data.remaining_woofs}`);

  // 3. Créer les orders/jobs pour chaque asset sélectionné
  const selectedAssets = pack.assets.filter((a) => selectedAssetIds.includes(a.id));
  
  try {
  const results = await Promise.all(
      selectedAssets.map((asset) => {
        // ✅ DEBUG LOG : Vérifier generatedTexts
        console.log(`[Pack] Creating job for asset ${asset.id}:`, {
          kind: asset.kind,
          referenceImageUrl: asset.referenceImageUrl || "❌ MISSING",
          title: asset.title,
          carouselMode: asset.kind === 'carousel' ? carouselMode : undefined,
          hasGeneratedTexts: !!asset.generatedTexts,
          slidesCount: asset.generatedTexts?.slides?.length || 0,
          slidesPreview: asset.generatedTexts?.slides?.slice(0, 2).map((s: any) => ({ title: s.title?.slice(0, 30), hasBody: !!s.body })),
          visualStyle,
        });
        return createAssetJob(asset, brandId, userId, pack.title, useBrandKit, useLogo, userPlan, carouselMode, colorMode, visualStyle);
      })
    );

    const orderIds = results.map((r) => r.orderId);
    console.log(`[Pack] Génération lancée, orderIds:`, orderIds);

    // 🚀 Déclencher le worker pour traiter les jobs immédiatement
    try {
      console.log("[Pack] Triggering alfie-job-worker...");
      await supabase.functions.invoke("alfie-job-worker", {
        body: { trigger: "pack_from_chat", orderIds }
      });
      console.log("[Pack] Worker triggered successfully");
    } catch (workerErr) {
      console.error("[Pack] Worker trigger failed (jobs will be processed by queue-monitor):", workerErr);
      // On ne throw pas - le queue-monitor finira par déclencher le worker
    }

    return { success: true, orderIds };
  } catch (error) {
    console.error("[Pack] Job creation failed, refunding Woofs:", error);
    
    // Refund des Woofs en cas d'échec de création des jobs
    try {
      await supabase.functions.invoke("alfie-refund-woofs", {
        body: {
          amount: totalWoofs,
          reason: "pack_creation_failed",
          metadata: { 
            packTitle: pack.title,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      });
      console.log(`[Pack] Refunded ${totalWoofs} Woofs after job creation failure`);
    } catch (refundError) {
      console.error("[Pack] Failed to refund Woofs:", refundError);
    }
    
    throw error;
  }
}

/**
 * Crée un job pour un asset du pack
 * Utilise la même logique que le Studio pour créer des orders
 */
async function createAssetJob(
  asset: any,
  brandId: string,
  userId: string,
  packTitle: string,
  useBrandKit: boolean = true,
  useLogo: boolean = false, // ✅ NEW: Option logo
  userPlan: string = 'starter',
  carouselMode: 'standard' | 'premium' = 'standard',
  colorMode: 'vibrant' | 'pastel' = 'vibrant',
  visualStyle: 'background' | 'character' | 'product' = 'background' // ✅ NEW
): Promise<{ orderId: string }> {
  // Créer un order pour cet asset
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      brand_id: brandId,
      campaign_name: `${packTitle} - ${asset.title}`,
      status: "queued",
      brief_json: {
        format: asset.kind === "carousel" ? "carousel" : asset.kind.includes("video") ? "video" : "image",
        platform: asset.platform,
        ratio: asset.ratio,
        goal: asset.goal,
        tone: asset.tone,
        topic: asset.prompt,
        slides: asset.kind === "carousel" ? asset.count : undefined,
        durationSeconds: asset.durationSeconds,
      },
      metadata: {
        source: "alfie_chat_pack",
        packTitle,
        assetKind: asset.kind,
      },
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("[Pack] Failed to create order:", orderError);
    throw new Error(`Failed to create order for ${asset.title}`);
  }

  // Créer un job dans la queue
  const jobType = asset.kind === "carousel" ? "render_carousels" : 
                  asset.kind.includes("video") ? "generate_video" : 
                  "render_images";

  // Générer un carousel_id unique (UUID valide) pour les carrousels
  const carousel_id = asset.kind === "carousel" ? crypto.randomUUID() : undefined;

  // Vidéos premium uniquement (Veo 3.1)
  const videoEngine = asset.kind === "video_premium" ? "veo_3_1" : undefined;

  const { error: jobError } = await supabase.from("job_queue").insert({
    user_id: userId,
    order_id: order.id,
    brand_id: brandId,
    type: jobType,
    kind: asset.kind === "video_premium" ? "premium" : "standard",
    status: "queued",
    payload: {
      orderId: order.id,
      userId,
      brandId,
      brief: typeof order.brief_json === 'object' && order.brief_json !== null && !Array.isArray(order.brief_json)
        ? {
            ...(order.brief_json as Record<string, any>),
            topic: asset.prompt || asset.title || packTitle,
            content: asset.prompt || asset.title,
          }
        : {
            topic: asset.prompt || asset.title || packTitle,
            content: asset.prompt || asset.title,
          },
      assetId: asset.id,
      prompt: asset.prompt || asset.title || packTitle,
      carousel_id,
      count: asset.kind === "carousel" ? asset.count : 1,
      referenceImageUrl: asset.referenceImageUrl,
      generatedTexts: asset.generatedTexts,
      campaign: packTitle,
      useBrandKit,
      useLogo, // ✅ NEW: Option logo
      userPlan,
      carouselMode: asset.kind === "carousel" ? (asset.carouselMode || carouselMode) : undefined, // ✅ Mode Standard/Premium
      colorMode: colorMode, // ✅ Mode Coloré/Pastel
      carouselType: asset.kind === "carousel" ? (asset.carouselType || 'content') : undefined, // ✅ Type: citations ou content
      visualStyle: visualStyle, // ✅ NEW: Style visuel adaptatif (background/character/product)
      withAudio: false,
      engine: videoEngine,
      durationSeconds: asset.durationSeconds || 5,
      aspectRatio: asset.ratio || "4:5",
    },
  });

  if (jobError) {
    console.error("[Pack] Failed to create job:", jobError);
    throw new Error(`Failed to create job for ${asset.title}`);
  }

  return { orderId: order.id };
}
