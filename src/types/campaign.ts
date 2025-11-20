/**
 * Types for Campaign Factory
 * Campaigns and Assets management
 */

export type CampaignStatus = 'draft' | 'running' | 'done';
export type AssetType = 'image' | 'carousel' | 'video';
export type AssetStatus = 'pending' | 'generating' | 'ready' | 'failed';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface AssetConfig {
  prompt?: string;
  topic?: string;
  slides?: number;
  count?: number;
  brandKit?: {
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    logo_url?: string;
    tone?: string;
  };
  // For carousel content
  carouselData?: {
    title: string;
    slides: Array<{
      heading: string;
      body: string;
    }>;
    cta?: string;
  };
  // Additional options
  options?: Record<string, any>;
}

export interface Asset {
  id: string;
  campaign_id: string;
  type: AssetType;
  status: AssetStatus;
  config: AssetConfig;
  file_urls: string[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithAssets extends Campaign {
  assets: Asset[];
}

export interface CreateCampaignRequest {
  name: string;
  status?: CampaignStatus;
}

export interface CreateAssetRequest {
  campaign_id: string;
  type: AssetType;
  config: AssetConfig;
  status?: AssetStatus;
}

export interface UpdateCampaignRequest {
  name?: string;
  status?: CampaignStatus;
}

export interface UpdateAssetRequest {
  status?: AssetStatus;
  config?: AssetConfig;
  file_urls?: string[];
  error_message?: string | null;
}

// Campaign plan from Chat Alfie
export interface CampaignPlan {
  campaign_name: string;
  assets: Array<{
    type: AssetType;
    count: number;
    topic: string;
    slides?: number;
  }>;
}

// Response from campaign creation
export interface CreateCampaignResponse {
  campaign: Campaign;
  assets: Asset[];
}
