import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

      // Récupérer les stats de génération du mois en cours
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: generations } = await supabase
        .from('media_generations')
        .select('type, woofs')
        .eq('user_id', user.id)
        .eq('brand_id', activeBrandId)
        .gte('created_at', startOfMonth.toISOString());

      // Récupérer les quotas de la marque
      const { data: brand } = await supabase
        .from('brands')
        .select('quota_images, quota_videos, quota_woofs')
        .eq('id', activeBrandId)
        .single();

      const imagesCount = generations?.filter(g => g.type === 'image').length || 0;
      const videosCount = generations?.filter(g => g.type === 'video').length || 0;
      const totalWoofsUsed = generations?.reduce((sum, g) => sum + (g.woofs || 0), 0) || 0;

      setStats({
        imagesCount,
        videosCount,
        totalWoofsUsed,
        imagesQuota: brand?.quota_images || 0,
        videosQuota: brand?.quota_videos || 0,
        woofsQuota: brand?.quota_woofs || 0,
      });
    } catch (error) {
      console.error('Error loading activity stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: loadStats };
}
