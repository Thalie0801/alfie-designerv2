export type CampaignAssetType = "image" | "carousel" | "video";

export interface CampaignAssetPlan {
  type: CampaignAssetType;
  count: number;
  topic: string;
  slides?: number;
  brandKit?: unknown;
}

export interface CampaignPlan {
  campaign_name: string;
  assets: CampaignAssetPlan[];
}

export interface CreateCampaignResponse {
  ok: boolean;
  message?: string;
  campaign_id?: string;
}
