import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignAsset, CampaignRow } from "@/types/campaign";

async function fetchCampaigns(): Promise<CampaignRow[]> {
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (campaignError) {
    console.error("[Campaigns] Failed to load campaigns", campaignError);
    throw campaignError;
  }

  if (!campaigns?.length) {
    return [];
  }

  const campaignIds = campaigns.map((c) => c.id);
  const { data: assets, error: assetError } = await supabase
    .from("assets")
    .select("*")
    .in("campaign_id", campaignIds);

  if (assetError) {
    console.error("[Campaigns] Failed to load assets", assetError);
    throw assetError;
  }

  const assetsByCampaign: Record<string, CampaignAsset[]> = {};
  (assets || []).forEach((asset) => {
    const list = assetsByCampaign[asset.campaign_id] || [];
    list.push(asset as CampaignAsset);
    assetsByCampaign[asset.campaign_id] = list;
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    assets: assetsByCampaign[campaign.id] || [],
  }));
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  });
}

export function useCampaignsInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["campaigns"] });
}
