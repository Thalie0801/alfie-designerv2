// Gestionnaire de quotas mensuels par marque (Woofs uniquement)

import { supabase } from '@/lib/supabase';
import { WOOF_COSTS } from '@/config/woofs';

export interface QuotaStatus {
  woofs: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    canGenerate: (cost: number) => boolean;
  };
  brandName?: string;
  plan?: string;
  resetsOn?: string;
}

/**
 * Récupère le statut des quotas Woofs pour une marque
 */
export async function getQuotaStatus(brandId: string): Promise<QuotaStatus | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-quota', {
      body: { brand_id: brandId }
    });

    if (error) throw error;
    if (!data) return null;

    const used = data.woofs_used || 0;
    const limit = data.woofs_quota || 0;
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return {
      woofs: {
        used,
        limit,
        remaining,
        percentage,
        canGenerate: (cost: number) => remaining >= cost
      },
      brandName: data.brand_name ?? undefined,
      plan: data.plan ?? undefined,
      resetsOn: data.reset_date ?? undefined
    };
  } catch (error) {
    console.error('Error fetching quota status:', error);
    return null;
  }
}

/**
 * Consomme des Woofs pour une marque via l'Edge Function centralisée
 */
export async function consumeQuota(
  brandId: string,
  type: 'image' | 'carousel_slide' | 'carousel_slide_premium' | 'video_premium',
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const costWoofs = WOOF_COSTS[type];
    
    const { data, error } = await supabase.functions.invoke('woofs-check-consume', {
      body: {
        brand_id: brandId,
        cost_woofs: costWoofs,
        reason: type,
        metadata: metadata || {}
      }
    });

    if (error) throw error;
    return data?.ok === true;
  } catch (error) {
    console.error('Error consuming quota:', error);
    return false;
  }
}

/**
 * Vérifie si une marque peut générer un visuel (1 Woof)
 */
export async function canGenerateVisual(brandId: string): Promise<{ canGenerate: boolean; reason?: string }> {
  const status = await getQuotaStatus(brandId);
  
  if (!status) {
    return { canGenerate: false, reason: 'Impossible de récupérer les quotas de la marque' };
  }

  const cost = WOOF_COSTS.image;
  
  if (!status.woofs.canGenerate(cost)) {
    const resetDate = new Date(status.resetsOn || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return { 
      canGenerate: false, 
      reason: `Woofs insuffisants pour ${status.brandName} (${status.woofs.remaining} restants, ${cost} requis). Ajoutez un Pack Woofs ou patientez jusqu'au ${resetDate}.` 
    };
  }

  return { canGenerate: true };
}

/**
 * Vérifie si une marque peut générer une vidéo premium (Veo 3.1)
 */
export async function canGenerateVideo(
  brandId: string
): Promise<{ canGenerate: boolean; reason?: string }> {
  const status = await getQuotaStatus(brandId);
  
  if (!status) {
    return { canGenerate: false, reason: 'Impossible de récupérer les quotas de la marque' };
  }

  const cost = WOOF_COSTS.video_premium;
  const resetDate = new Date(status.resetsOn || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  if (!status.woofs.canGenerate(cost)) {
    return { 
      canGenerate: false, 
      reason: `Woofs insuffisants pour ${status.brandName} (${status.woofs.remaining} restants, ${cost} requis). Ajoutez un Pack Woofs ou patientez jusqu'au ${resetDate}.` 
    };
  }

  return { canGenerate: true };
}

/**
 * Affiche une alerte si les Woofs approchent de la limite (80% ou 100%)
 */
export function checkQuotaAlert(status: QuotaStatus): { level: 'warning' | 'error' | null; message: string } | null {
  const woofsPercent = status.woofs.percentage;
  const resetDate = new Date(status.resetsOn || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  if (woofsPercent >= 100) {
    return {
      level: 'error',
      message: `⚠️ Quota Woofs atteint pour ${status.brandName}! Ajoutez un Pack Woofs ou patientez jusqu'au ${resetDate}.`
    };
  }

  if (woofsPercent >= 80) {
    return {
      level: 'warning',
      message: `⚠️ Vous avez utilisé ${woofsPercent.toFixed(0)}% de vos Woofs pour ${status.brandName}.`
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