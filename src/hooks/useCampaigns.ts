/**
 * React hooks for campaign management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getCampaigns,
  getCampaign,
  getCampaignWithAssets,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  createAsset,
  createAssets,
  updateAsset,
  deleteAsset,
  createCampaignWithAssets,
  subscribeToAssets,
} from '@/services/campaignService';
import type {
  CreateCampaignRequest,
  CreateAssetRequest,
  UpdateCampaignRequest,
  UpdateAssetRequest,
} from '@/types/campaign';

/**
 * Hook to fetch all campaigns
 */
export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  });
}

/**
 * Hook to fetch a single campaign
 */
export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => (id ? getCampaign(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch a campaign with all its assets
 */
export function useCampaignWithAssets(id: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', id, 'with-assets'],
    queryFn: () => (id ? getCampaignWithAssets(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to create a campaign
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/**
 * Hook to update a campaign
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignRequest }) =>
      updateCampaign(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.id] });
    },
  });
}

/**
 * Hook to delete a campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/**
 * Hook to create an asset
 */
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAsset,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['campaigns', data.campaign_id, 'with-assets'] 
      });
    },
  });
}

/**
 * Hook to create multiple assets
 */
export function useCreateAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAssets,
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['campaigns', data[0].campaign_id, 'with-assets'] 
        });
      }
    },
  });
}

/**
 * Hook to update an asset
 */
export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssetRequest }) =>
      updateAsset(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['campaigns', data.campaign_id, 'with-assets'] 
      });
    },
  });
}

/**
 * Hook to delete an asset
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, campaignId }: { id: string; campaignId: string }) =>
      deleteAsset(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['campaigns', variables.campaignId, 'with-assets'] 
      });
    },
  });
}

/**
 * Hook to create a campaign with assets
 */
export function useCreateCampaignWithAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaign,
      assets,
    }: {
      campaign: CreateCampaignRequest;
      assets: Omit<CreateAssetRequest, 'campaign_id'>[];
    }) => createCampaignWithAssets(campaign, assets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/**
 * Hook to subscribe to real-time asset updates
 */
export function useAssetSubscription(campaignId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!campaignId) return;

    const channel = subscribeToAssets(campaignId, (payload) => {
      console.log('[Campaign] Asset update:', payload);
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ 
        queryKey: ['campaigns', campaignId, 'with-assets'] 
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [campaignId, queryClient]);
}
