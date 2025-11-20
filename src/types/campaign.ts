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

export type CampaignStatus = "pending" | "generating" | "ready" | "failed";

export interface CampaignAsset {
  id: string;
  campaign_id: string;
  user_id?: string;
  type: CampaignAssetType;
  status: CampaignStatus;
  config?: Record<string, any> | null;
  file_urls?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignRow {
  id: string;
  user_id?: string;
  name?: string | null;
  status?: CampaignStatus;
  config?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  assets?: CampaignAsset[];
}
