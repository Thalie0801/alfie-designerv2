import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { SYSTEM_CONFIG } from '@/config/systemConfig';

export type BrandTier = 'starter' | 'pro' | 'studio';

export function useBrandManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  /**
   * Crée une nouvelle marque (add-on "Marque +")
   */
  const createAddonBrand = async (brandData: {
    name: string;
    palette?: string[];
    logo_url?: string;
    fonts?: any;
    voice?: string;
  }) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return null;
    }

    setLoading(true);
    try {
      // Note: Brand limit check should be done in the UI component before calling this function

      const quotas = SYSTEM_CONFIG.QUOTAS.starter;
      const nextReset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      
      const { data, error } = await supabase
        .from('brands')
        .insert([{
          user_id: user.id,
          name: brandData.name,
          plan: 'starter',
          is_addon: true,
          quota_images: quotas.images,
          quota_videos: quotas.videos,
          quota_woofs: quotas.woofs,
          images_used: 0,
          videos_used: 0,
          woofs_used: 0,
          palette: brandData.palette || [],
          logo_url: brandData.logo_url,
          fonts: brandData.fonts,
          voice: brandData.voice,
          resets_on: nextReset.toISOString().split('T')[0],
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Marque "${brandData.name}" créée avec succès !`);
      return data;
    } catch (error: any) {
      console.error('Error creating addon brand:', error);
      toast.error('Erreur lors de la création de la marque: ' + error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Upgrade une marque vers un tier supérieur
   */
  const upgradeBrand = async (brandId: string, newTier: BrandTier) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return false;
    }

    setLoading(true);
    try {
      const { data: currentBrand, error: fetchError } = await supabase
        .from('brands')
        .select('plan, name')
        .eq('id', brandId)
        .single();

      if (fetchError) throw fetchError;

      const currentTier = currentBrand.plan as BrandTier;
      
      // Vérifier que c'est bien un upgrade
      const tierOrder = { starter: 1, pro: 2, studio: 3 };
      if (tierOrder[newTier] <= tierOrder[currentTier]) {
        toast.error('Vous ne pouvez upgrader que vers un plan supérieur');
        return false;
      }

      const quotas = SYSTEM_CONFIG.QUOTAS[newTier];

      const { error: updateError } = await supabase
        .from('brands')
        .update({
          plan: newTier,
          quota_images: quotas.images,
          quota_videos: quotas.videos,
          quota_woofs: quotas.woofs,
        })
        .eq('id', brandId);

      if (updateError) throw updateError;

      toast.success(`Marque "${currentBrand.name}" upgradée vers ${newTier.toUpperCase()} !`);
      return true;
    } catch (error: any) {
      console.error('Error upgrading brand:', error);
      toast.error('Erreur lors de l\'upgrade: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ajouter un Pack Woofs à une marque
   */
  const addWoofsPack = async (brandId: string, packSize: 50 | 100) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return false;
    }

    setLoading(true);
    try {
      const { data: currentBrand, error: fetchError } = await supabase
        .from('brands')
        .select('quota_woofs, name')
        .eq('id', brandId)
        .single();

      if (fetchError) throw fetchError;

      const newQuotaWoofs = (currentBrand.quota_woofs || 0) + packSize;

      const { error: updateError } = await supabase
        .from('brands')
        .update({
          quota_woofs: newQuotaWoofs,
        })
        .eq('id', brandId);

      if (updateError) throw updateError;

      toast.success(`+${packSize} Woofs ajoutés à "${currentBrand.name}" !`);
      return true;
    } catch (error: any) {
      console.error('Error adding woofs pack:', error);
      toast.error('Erreur lors de l\'ajout du pack: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcule le coût d'upgrade entre deux tiers
   */
  const getUpgradeCost = (from: BrandTier, to: BrandTier): number => {
    const key = `${from}_to_${to}` as keyof typeof SYSTEM_CONFIG.UPGRADE_DIFF;
    return SYSTEM_CONFIG.UPGRADE_DIFF[key] || 0;
  };

  return {
    createAddonBrand,
    upgradeBrand,
    addWoofsPack,
    getUpgradeCost,
    loading,
  };
}
