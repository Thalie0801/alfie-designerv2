// Gestionnaire de quotas mensuels par marque (visuels, vidéos, Woofs)

import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_CONFIG } from '@/config/systemConfig';

export interface QuotaStatus {
  visuals: {
    used: number;
    limit: number;
    percentage: number;
    canGenerate: boolean;
  };
  videos: {
    used: number;
    limit: number;
    percentage: number;
    canGenerate: boolean;
  };
  woofs: {
    consumed: number;
    limit: number;
    remaining: number;
    canUse: (cost: number) => boolean;
  };
  brandName?: string;
  plan?: string;
  resetsOn?: string;
}

/**
 * Récupère le statut des quotas pour une marque
 */
export async function getQuotaStatus(brandId: string): Promise<QuotaStatus | null> {
  try {
    const { data: brand, error } = await supabase
      .from('brands')
      .select('name, plan, quota_images, quota_videos, quota_woofs, images_used, videos_used, woofs_used, resets_on')
      .eq('id', brandId)
      .single();

    if (error) throw error;
    if (!brand) return null;

    const visualsUsed = brand.images_used || 0;
    const visualsLimit = brand.quota_images || 0;
    const visualsPercentage = visualsLimit > 0 ? (visualsUsed / visualsLimit) * 100 : 0;

    const videosUsed = brand.videos_used || 0;
    const videosLimit = brand.quota_videos || 0;
    const videosPercentage = videosLimit > 0 ? (videosUsed / videosLimit) * 100 : 0;

    const woofsConsumed = brand.woofs_used || 0;
    const woofsLimit = brand.quota_woofs || 0;
    const woofsRemaining = Math.max(0, woofsLimit - woofsConsumed);

    const hardStopThreshold = SYSTEM_CONFIG.HARD_STOP_MULTIPLIER * 100; // 110%

    return {
      visuals: {
        used: visualsUsed,
        limit: visualsLimit,
        percentage: visualsPercentage,
        canGenerate: visualsPercentage < hardStopThreshold
      },
      videos: {
        used: videosUsed,
        limit: videosLimit,
        percentage: videosPercentage,
        canGenerate: videosPercentage < hardStopThreshold
      },
      woofs: {
        consumed: woofsConsumed,
        limit: woofsLimit,
        remaining: woofsRemaining,
        canUse: (cost: number) => woofsRemaining >= cost
      },
      brandName: brand.name,
      plan: brand.plan ?? undefined,
      resetsOn: brand.resets_on ?? undefined
    };
  } catch (error) {
    console.error('Error fetching quota status:', error);
    return null;
  }
}

/**
 * Consomme des quotas pour une marque (images et/ou vidéos + Woofs)
 */
export async function consumeQuota(
  brandId: string, 
  type: 'visual' | 'video',
  woofCost?: number
): Promise<boolean> {
  try {
    const { data: brand, error: fetchError } = await supabase
      .from('brands')
      .select('images_used, videos_used, woofs_used')
      .eq('id', brandId)
      .single();

    if (fetchError) throw fetchError;

    const updates: any = {};

    if (type === 'visual') {
      updates.images_used = (brand.images_used || 0) + 1;
    }

    if (type === 'video' && woofCost !== undefined) {
      updates.videos_used = (brand.videos_used || 0) + 1;
      updates.woofs_used = (brand.woofs_used || 0) + woofCost;
    }

    const { error: updateError } = await supabase
      .from('brands')
      .update(updates)
      .eq('id', brandId);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error('Error consuming quota:', error);
    return false;
  }
}

/**
 * Vérifie si une marque peut générer un visuel (avant de lancer)
 */
export async function canGenerateVisual(brandId: string): Promise<{ canGenerate: boolean; reason?: string }> {
  const status = await getQuotaStatus(brandId);
  
  if (!status) {
    return { canGenerate: false, reason: 'Impossible de récupérer les quotas de la marque' };
  }

  if (!status.visuals.canGenerate) {
    const resetDate = new Date(status.resetsOn || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return { 
      canGenerate: false, 
      reason: `Quota atteint pour ${status.brandName}. Ajoutez un Pack Visuels ou patientez jusqu'au ${resetDate}.` 
    };
  }

  return { canGenerate: true };
}

/**
 * Vérifie si une marque peut générer une vidéo (avec coût Woofs)
 */
export async function canGenerateVideo(
  brandId: string, 
  woofCost: number
): Promise<{ canGenerate: boolean; reason?: string; fallbackMessage?: string }> {
  const status = await getQuotaStatus(brandId);
  
  if (!status) {
    return { canGenerate: false, reason: 'Impossible de récupérer les quotas de la marque' };
  }

  const resetDate = new Date(status.resetsOn || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  if (!status.videos.canGenerate) {
    return { 
      canGenerate: false, 
      reason: `Quota vidéos atteint pour ${status.brandName}. Ajoutez un Pack Woofs (+50 / +100) ou patientez jusqu'au ${resetDate}.` 
    };
  }

  if (!status.woofs.canUse(woofCost)) {
    // Si Veo3 demandé mais pas assez de Woofs, suggérer Sora
    if (woofCost === 4) {
      return { 
        canGenerate: false, 
        reason: `Veo 3 consomme 4 Woofs, budget insuffisant pour ${status.brandName}. Utilisez Sora (1 Woof) ou ajoutez un Pack Woofs (+50 / +100).`,
        fallbackMessage: `Il vous reste ${status.woofs.remaining} Woofs. Veo 3 nécessite 4 Woofs, mais Sora n'en utilise qu'1.`
      };
    }
    
    return { 
      canGenerate: false, 
      reason: `Woofs insuffisants pour ${status.brandName} (${status.woofs.remaining} restants, ${woofCost} requis). Ajoutez un Pack Woofs (+50 / +100) ou patientez jusqu'au ${resetDate}.` 
    };
  }

  return { canGenerate: true };
}

/**
 * Affiche une alerte si les quotas approchent de la limite (80% ou 100%)
 */
export function checkQuotaAlert(status: QuotaStatus): { level: 'warning' | 'error' | null; message: string } | null {
  const visualsPercent = status.visuals.percentage;
  const videosPercent = status.videos.percentage;
  const woofsPercent = status.woofs.limit > 0 ? (status.woofs.consumed / status.woofs.limit) * 100 : 0;

  const resetDate = new Date(status.resetsOn || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const alertThreshold = SYSTEM_CONFIG.ALERT_THRESHOLD * 100; // 80%
  const packSizes = SYSTEM_CONFIG.PACK_WOOFS_SIZES.join(' / +');

  if (visualsPercent >= 100 || videosPercent >= 100 || woofsPercent >= 100) {
    return {
      level: 'error',
      message: `⚠️ Quota atteint pour ${status.brandName}! Ajoutez un Pack Woofs (+${packSizes}) ou patientez jusqu'au ${resetDate}.`
    };
  }

  const maxPercent = Math.max(visualsPercent, videosPercent, woofsPercent);
  if (maxPercent >= alertThreshold) {
    return {
      level: 'warning',
      message: `⚠️ Vous avez utilisé ${maxPercent.toFixed(0)}% de vos quotas pour ${status.brandName}.`
    };
  }

  return null;
}

/**
 * Formatte un message d'expiration pour un asset
 */
export function formatExpirationMessage(expiresAt: string): string {
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const formattedDate = expiryDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  if (daysLeft <= 0) {
    return `⚠️ Expiré. Asset supprimé.`;
  } else if (daysLeft <= 7) {
    return `⚠️ Disponible jusqu'au ${formattedDate} (J+${daysLeft}). Téléchargez avant purge.`;
  }
  
  return `Disponible jusqu'au ${formattedDate} (J+30). Téléchargez avant purge.`;
}