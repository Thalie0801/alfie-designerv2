import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

/**
 * Consommer un quota pour une marque
 */
export async function consumeBrandQuota(
  supabaseClient: SupabaseClient,
  brandId: string,
  type: 'visual' | 'video',
  woofCost: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    // Récupérer les quotas actuels
    const { data: brand, error: fetchError } = await supabaseClient
      .from('brands')
      .select('images_used, videos_used, woofs_used, quota_images, quota_videos, quota_woofs')
      .eq('id', brandId)
      .single();

    if (fetchError) {
      console.error('Error fetching brand quota:', fetchError);
      return { success: false, error: 'Failed to fetch brand quota' };
    }

    if (!brand) {
      return { success: false, error: 'Brand not found' };
    }

    // Vérifier les quotas disponibles
    if (type === 'visual') {
      if ((brand.images_used || 0) >= (brand.quota_images || 0)) {
        return { success: false, error: 'Quota visuel épuisé' };
      }
    } else {
      if ((brand.videos_used || 0) >= (brand.quota_videos || 0)) {
        return { success: false, error: 'Quota vidéo épuisé' };
      }
      if (woofCost > 0 && (brand.woofs_used || 0) + woofCost > (brand.quota_woofs || 0)) {
        return { success: false, error: 'Woofs insuffisants' };
      }
    }

    // Calculer les nouvelles valeurs
    const updates: any = {};
    if (type === 'visual') {
      updates.images_used = (brand.images_used || 0) + 1;
    } else {
      updates.videos_used = (brand.videos_used || 0) + 1;
      if (woofCost > 0) {
        updates.woofs_used = (brand.woofs_used || 0) + woofCost;
      }
    }

    // Mettre à jour
    const { error: updateError } = await supabaseClient
      .from('brands')
      .update(updates)
      .eq('id', brandId);

    if (updateError) {
      console.error('Error updating brand quota:', updateError);
      return { success: false, error: 'Failed to update quota' };
    }

    console.log(`✅ Quota consumed for brand ${brandId}: ${type}, woofs: ${woofCost}`);
    return { success: true };
  } catch (error) {
    console.error('Error in consumeBrandQuota:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
