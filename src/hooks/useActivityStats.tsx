import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

interface ActivityStats {
  imagesCount: number;
  videosCount: number;
  totalWoofsUsed: number;
  imagesQuota: number;
  videosQuota: number;
  woofsQuota: number;
}

export function useActivityStats(activeBrandId: string | null) {
  const { user } = useAuth();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activeBrandId) {
      setLoading(false);
      return;
    }

    loadStats();
  }, [user, activeBrandId]);

  const loadStats = async () => {
    if (!user || !activeBrandId) return;

    try {
      setLoading(true);

      // ✅ Calculer la période actuelle YYYYMM (ex: 202511 pour novembre 2025)
      const now = new Date();
      const periodYYYYMM = parseInt(
        now.getFullYear().toString() + 
        (now.getMonth() + 1).toString().padStart(2, '0')
      );

      // ✅ Lire les compteurs mensuels depuis counters_monthly (source de vérité)
      const { data: counter } = await supabase
        .from('counters_monthly')
        .select('images_used, reels_used, woofs_used')
        .eq('brand_id', activeBrandId)
        .eq('period_yyyymm', periodYYYYMM)
        .maybeSingle();

      // ✅ NOUVEAU : Appeler get-quota pour avoir le bypass admin sur les quotas
      const { data: quotaData, error: quotaError } = await supabase.functions.invoke('get-quota', {
        body: { brand_id: activeBrandId },
      });

      if (quotaError || !quotaData?.ok) {
        console.error('Error loading quota:', quotaError);
        // Fallback: utiliser les quotas de la marque directement
        const { data: brand } = await supabase
          .from('brands')
          .select('quota_images, quota_videos, quota_woofs')
          .eq('id', activeBrandId)
          .single();

        setStats({
          imagesCount: counter?.images_used || 0,
          videosCount: counter?.reels_used || 0,
          totalWoofsUsed: counter?.woofs_used || 0,
          imagesQuota: brand?.quota_images || 0,
          videosQuota: brand?.quota_videos || 0,
          woofsQuota: brand?.quota_woofs || 0,
        });
      } else {
        // Utiliser les quotas de get-quota (avec bypass admin si applicable)
        setStats({
          imagesCount: counter?.images_used || 0,
          videosCount: counter?.reels_used || 0,
          totalWoofsUsed: quotaData.data.woofs_used || 0,
          imagesQuota: quotaData.data.woofs_quota || 0,
          videosQuota: quotaData.data.woofs_quota || 0,
          woofsQuota: quotaData.data.woofs_quota || 0,
        });
      }
    } catch (error) {
      console.error('Error loading activity stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: loadStats };
}
