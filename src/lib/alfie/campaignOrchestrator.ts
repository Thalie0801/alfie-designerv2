/**
 * Campaign Orchestrator
 * Handles campaign creation from Chat Alfie
 */

import { supabase } from '@/integrations/supabase/client';
import { getAuthHeader } from '@/lib/auth';
import type { CampaignPlan, CreateCampaignResponse } from '@/types/campaign';

/**
 * Parse user message to detect campaign creation intent
 * Examples:
 * - "Fais-moi 3 carrousels et 5 images pour [sujet]"
 * - "Crée une campagne avec 2 vidéos et 10 images sur [sujet]"
 */
export function detectCampaignIntent(message: string): boolean {
  const campaignKeywords = /\b(campagne|campaign)\b/i;
  const multipleAssetsPattern = /\b(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\b.*\b(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\b/i;
  
  return campaignKeywords.test(message) || multipleAssetsPattern.test(message);
}

/**
 * Extract campaign plan from user message using simple pattern matching
 * This is a basic implementation - you can enhance it with LLM later
 */
export function extractCampaignPlan(message: string, brandKit?: any): CampaignPlan | null {
  // Pattern: "X carrousels et Y images pour [sujet]"
  const pattern = /(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\s*(?:et|and)?\s*(\d+)?\s*(carrousels?|carousels?|images?|vid[ée]os?)?\s*(?:pour|sur|about)\s*(.+)/i;
  const match = message.match(pattern);
  
  if (!match) {
    // Try simpler pattern: "X carrousels [sujet]"
    const simplePattern = /(\d+)\s*(carrousels?|carousels?|images?|vid[ée]os?)\s*(?:pour|sur|about)?\s*(.+)/i;
    const simpleMatch = message.match(simplePattern);
    
    if (simpleMatch) {
      const [, count, type, topic] = simpleMatch;
      const assetType = normalizeAssetType(type);
      
      return {
        campaign_name: `Campagne ${topic.substring(0, 50)}`,
        assets: [
          {
            type: assetType,
            count: parseInt(count, 10),
            topic: topic.trim(),
            slides: assetType === 'carousel' ? 5 : undefined,
          },
        ],
      };
    }
    
    return null;
  }
  
  const [, count1, type1, count2, type2, topic] = match;
  const assets = [];
  
  // First asset type
  const assetType1 = normalizeAssetType(type1);
  assets.push({
    type: assetType1,
    count: parseInt(count1, 10),
    topic: topic.trim(),
    slides: assetType1 === 'carousel' ? 5 : undefined,
  });
  
  // Second asset type (if exists)
  if (count2 && type2) {
    const assetType2 = normalizeAssetType(type2);
    assets.push({
      type: assetType2,
      count: parseInt(count2, 10),
      topic: topic.trim(),
      slides: assetType2 === 'carousel' ? 5 : undefined,
    });
  }
  
  return {
    campaign_name: `Campagne ${topic.substring(0, 50)}`,
    assets,
  };
}

/**
 * Normalize asset type from French/English variations
 */
function normalizeAssetType(type: string): 'image' | 'carousel' | 'video' {
  const normalized = type.toLowerCase();
  
  if (/carrousel|carousel/.test(normalized)) {
    return 'carousel';
  }
  
  if (/vid[ée]o/.test(normalized)) {
    return 'video';
  }
  
  return 'image';
}

/**
 * Create a campaign from a plan by calling the Edge Function
 */
export async function createCampaignFromPlan(
  plan: CampaignPlan,
  brandKit?: any
): Promise<CreateCampaignResponse> {
  const authHeader = await getAuthHeader();
  
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-create-campaign`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        campaign_name: plan.campaign_name,
        assets: plan.assets,
        brandKit,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create campaign');
  }
  
  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(result.message || 'Failed to create campaign');
  }
  
  return {
    campaign: result.campaign,
    assets: result.assets,
  };
}

/**
 * Generate a user-friendly confirmation message
 */
export function generateCampaignConfirmationMessage(
  campaignName: string,
  summary: {
    images: number;
    carousels: number;
    videos: number;
  }
): string {
  const parts = [];
  
  if (summary.carousels > 0) {
    parts.push(`${summary.carousels} carrousel${summary.carousels > 1 ? 's' : ''}`);
  }
  
  if (summary.images > 0) {
    parts.push(`${summary.images} image${summary.images > 1 ? 's' : ''}`);
  }
  
  if (summary.videos > 0) {
    parts.push(`${summary.videos} vidéo${summary.videos > 1 ? 's' : ''}`);
  }
  
  const assetsList = parts.join(' et ');
  
  return `✅ Parfait ! Je lance ${assetsList} pour ta campagne "${campaignName}".\n\nTu peux suivre la progression dans l'onglet Campagnes à droite. Je te préviens dès que c'est prêt ! 🚀`;
}
