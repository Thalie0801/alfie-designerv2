/**
 * Campaign Orchestrator
 * Handles campaign creation from Chat Alfie
 */

import { getAuthHeader } from "@/lib/auth";
import { SUPABASE_URL } from "@/config/env";
import type {
  CampaignAssetPlan,
  CampaignPlan,
  CreateCampaignResponse,
} from "@/types/campaign";

interface GenerateAssetsResponse {
  ok: boolean;
  message?: string;
  order_id?: string;
}

export type CampaignTaskPayload = {
  type: "image" | "carousel" | "video";
  prompt: string;
  ratio: "1:1" | "9:16" | "16:9" | "4:5";
  slide_count?: number | null;
  brand_kit_id?: string;
  style?: string;
  variant?: string;
};

/**
 * Detect if a user message is asking to create a campaign
 * Examples:
 * - "Fais-moi 3 carrousels et 5 images pour [sujet]"
 * - "Crée une campagne avec 2 vidéos et 10 images sur [sujet]"
 */
export function detectCampaignIntent(message: string): boolean {
  const campaignKeywords = /\b(campagne|campaign)\b/i;
  const multipleAssetsPattern =
    /\b(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\b.*\b(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\b/i;

  return campaignKeywords.test(message) || multipleAssetsPattern.test(message);
}

/**
 * Basic extraction of a campaign plan from a natural language message.
 * This is volontairement simple : on pourra le remplacer par un LLM plus tard.
 *
 * Pattern géré :
 *   "X carrousels et Y images pour [sujet]"
 *   "X images sur [sujet]"
 */
export function extractCampaignPlan(
  message: string,
  brandKit?: any
): CampaignPlan | null {
  // Pattern: "X carrousels et Y images pour [sujet]"
  const pattern =
    /(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\s*(?:et|and)?\s*(\d+)?\s*(carrousels?|carousels?|images?|vid[ée]os?)?\s*(?:pour|sur|about)\s*(.+)/i;

  const match = message.match(pattern);

  if (!match) {
    return null;
  }

  const firstCount = parseInt(match[1], 10);
  const firstType = normalizeAssetType(match[2]);
  const secondCount = match[3] ? parseInt(match[3], 10) : 0;
  const secondType = match[4] ? normalizeAssetType(match[4]) : null;
  const topic = match[5]?.trim() ?? "";

  const assets: CampaignPlan["assets"] = [];

  if (firstCount > 0) {
    assets.push({
      type: firstType,
      count: firstCount,
      topic,
      slides: firstType === "carousel" ? 5 : undefined,
      brandKit,
    });
  }

  if (secondType && secondCount > 0) {
    assets.push({
      type: secondType,
      count: secondCount,
      topic,
      slides: secondType === "carousel" ? 5 : undefined,
      brandKit,
    });
  }

  if (assets.length === 0) {
    return null;
  }

  return {
    campaign_name: topic || "Campagne Alfie",
    assets,
  };
}

/**
 * Normalize user text into our internal asset types.
 */
function normalizeAssetType(type: string): "image" | "carousel" | "video" {
  const normalized = type.toLowerCase();

  if (/carrousel|carousel/.test(normalized)) {
    return "carousel";
  }

  if (/vid[ée]o/.test(normalized)) {
    return "video";
  }

  return "image";
}

/**
 * Call the Edge Function that creates the campaign + assets in Supabase.
 */
export async function createCampaignFromPlan(
  plan: CampaignPlan,
  brandKit?: any
): Promise<CreateCampaignResponse> {
  const authHeader = await getAuthHeader();

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/chat-create-campaign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({
        campaign_name: plan.campaign_name,
        assets: plan.assets,
        brandKit,
      }),
    }
  );

  if (!response.ok) {
    let errorMessage = "Failed to create campaign";
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  const result = (await response.json()) as CreateCampaignResponse;

  if (!result.ok) {
    throw new Error(result.message || "Failed to create campaign");
  }

  return result;
}

const normalizeTaskToAsset = (task: CampaignTaskPayload): CampaignAssetPlan => ({
  type: task.type,
  count: 1,
  topic: task.prompt,
  slides: task.slide_count ?? undefined,
  brandKit: task.brand_kit_id,
  config: {
    prompt: task.prompt,
    ratio: task.ratio,
    slide_count: task.slide_count,
    brand_kit_id: task.brand_kit_id,
    style: task.style,
    variant: task.variant,
  },
});

export function tasksToAssetsPayload(
  tasks: CampaignTaskPayload[]
): CampaignAssetPlan[] {
  // TODO: déduire les crédits en fonction du nombre de tasks
  // TODO: enregistrer un variant A/B pour certains assets (ex: marquer les tasks avec "variant": "A" | "B")
  return tasks.map(normalizeTaskToAsset);
}

const resolveBrandKitId = (taskBrandKitId: string | undefined, brandKit?: any) => {
  if (taskBrandKitId && taskBrandKitId !== "CURRENT_USER_BRAND_KIT") return taskBrandKitId;
  if (brandKit?.id) return brandKit.id as string;
  return taskBrandKitId;
};

export async function createCampaignFromTasks(
  campaignName: string,
  tasks: CampaignTaskPayload[],
  brandKit?: any
): Promise<GenerateAssetsResponse> {
  const normalizedTasks = tasks.map((task) => ({
    ...task,
    brand_kit_id: resolveBrandKitId(task.brand_kit_id, brandKit),
  }));

  const authHeader = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({
      campaign_name: campaignName,
      tasks: normalizedTasks,
      brandKit,
    }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to launch asset generation";
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const result = (await response.json()) as GenerateAssetsResponse;

  if (!result.ok) {
    throw new Error(result.message || "Asset generation failed");
  }

  return result;
}
