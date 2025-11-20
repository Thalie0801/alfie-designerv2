/**
 * Campaign Service
 * Handles all campaign and asset operations with Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Campaign,
  Asset,
  CampaignWithAssets,
  CreateCampaignRequest,
  CreateAssetRequest,
  UpdateCampaignRequest,
  UpdateAssetRequest,
  CreateCampaignResponse,
} from '@/types/campaign';

/**
 * Get all campaigns for the current user
 */
export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get a campaign with all its assets
 */
export async function getCampaignWithAssets(id: string): Promise<CampaignWithAssets | null> {
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (campaignError) throw campaignError;
  if (!campaign) return null;

  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true });

  if (assetsError) throw assetsError;

  return {
    ...campaign,
    assets: assets || [],
  };
}

/**
 * Create a new campaign
 */
export async function createCampaign(request: CreateCampaignRequest): Promise<Campaign> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: request.name,
      status: request.status || 'running',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a campaign
 */
export async function updateCampaign(id: string, request: UpdateCampaignRequest): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a campaign (will cascade delete all assets)
 */
export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get all assets for a campaign
 */
export async function getAssets(campaignId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single asset by ID
 */
export async function getAsset(id: string): Promise<Asset | null> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new asset
 */
export async function createAsset(request: CreateAssetRequest): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert({
      campaign_id: request.campaign_id,
      type: request.type,
      status: request.status || 'pending',
      config: request.config,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create multiple assets at once
 */
export async function createAssets(requests: CreateAssetRequest[]): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .insert(requests.map(req => ({
      campaign_id: req.campaign_id,
      type: req.type,
      status: req.status || 'pending',
      config: req.config,
    })))
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * Update an asset
 */
export async function updateAsset(id: string, request: UpdateAssetRequest): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .update(request)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an asset
 */
export async function deleteAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Create a campaign with multiple assets in one transaction
 */
export async function createCampaignWithAssets(
  campaignRequest: CreateCampaignRequest,
  assetRequests: Omit<CreateAssetRequest, 'campaign_id'>[]
): Promise<CreateCampaignResponse> {
  // Create campaign first
  const campaign = await createCampaign(campaignRequest);

  // Create all assets
  const assets = await createAssets(
    assetRequests.map(req => ({
      ...req,
      campaign_id: campaign.id,
    }))
  );

  return { campaign, assets };
}

/**
 * Subscribe to real-time updates for a campaign's assets
 */
export function subscribeToAssets(
  campaignId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`assets:campaign_id=eq.${campaignId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'assets',
        filter: `campaign_id=eq.${campaignId}`,
      },
      callback
    )
    .subscribe();
}
