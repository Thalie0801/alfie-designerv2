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
    const error = quotaCheck.data?.error || "Quota verification failed";
    console.error("[Pack] Quota check failed:", error);
    
    if (error.includes("INSUFFICIENT") || error.includes("quota")) {
      throw new InsufficientWoofsError(
        `Il te reste moins de ${totalWoofs} Woofs. Ce pack en coûte ${totalWoofs}.`
      );
    }
    
    throw new Error(error);
  }

  console.log(`[Pack] Quota OK, remaining Woofs: ${quotaCheck.data.remaining_woofs}`);

  // 3. Créer les orders/jobs pour chaque asset sélectionné
  const selectedAssets = pack.assets.filter((a) => selectedAssetIds.includes(a.id));
  
  const results = await Promise.all(
    selectedAssets.map((asset) => createAssetJob(asset, brandId, userId, pack.title))
  );

  const orderIds = results.map((r) => r.orderId);
  console.log(`[Pack] Génération lancée, orderIds:`, orderIds);

  return { success: true, orderIds };
}

/**
 * Crée un job pour un asset du pack
 * Utilise la même logique que le Studio pour créer des orders
 */
async function createAssetJob(
  asset: any,
  brandId: string,
  userId: string,
  packTitle: string
): Promise<{ orderId: string }> {
  // Créer un order pour cet asset
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      brand_id: brandId,
      campaign_name: `${packTitle} - ${asset.title}`,
      status: "pending",
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
                  asset.kind.includes("video") ? "render_videos" : 
                  "render_images";

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
      brief: order.brief_json,
      assetId: asset.id,
      prompt: asset.prompt,
    },
  });

  if (jobError) {
    console.error("[Pack] Failed to create job:", jobError);
    throw new Error(`Failed to create job for ${asset.title}`);
  }

  return { orderId: order.id };
}
