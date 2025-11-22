import { SUPABASE_URL } from "@/config/env";
import { getAuthHeader } from "@/lib/auth";

export async function triggerAssetImageGeneration(assetId: string) {
  const headers = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/campaign-generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ asset_id: assetId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Impossible de lancer la génération d'image");
  }

  return response.json();
}

export async function requestCampaignArchive(campaignId: string) {
  const headers = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/archive-campaign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ campaign_id: campaignId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Impossible de créer l'archive de la campagne");
  }

  return response.json();
}
