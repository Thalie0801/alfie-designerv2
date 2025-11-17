import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface BrandQuota {
  brandId: string | null;
  brandName: string | null;
  imagesUsed: number;
  quotaImages: number;
  videosUsed: number;
  quotaVideos: number;
  woofsUsed: number;
  quotaWoofs: number;
  canGenerateImage: boolean;
  canGenerateVideo: boolean;
  imagesRemaining: number;
  videosRemaining: number;
  woofsRemaining: number;
}

export function useBrandQuota() {
  const { user } = useAuth();
  const [quota, setQuota] = useState<BrandQuota>({
    brandId: null,
    brandName: null,
    imagesUsed: 0,
    quotaImages: 0,
    videosUsed: 0,
    quotaVideos: 0,
    woofsUsed: 0,
    quotaWoofs: 0,
    canGenerateImage: false,
    canGenerateVideo: false,
    imagesRemaining: 0,
    videosRemaining: 0,
    woofsRemaining: 0
  });
  const [loading, setLoading] = useState(true);

  const loadQuota = useCallback(async () => {
    if (!user) {
      setQuota({
        brandId: null,
        brandName: null,
        imagesUsed: 0,
        quotaImages: 0,
        videosUsed: 0,
        quotaVideos: 0,
        woofsUsed: 0,
        quotaWoofs: 0,
        canGenerateImage: false,
        canGenerateVideo: false,
        imagesRemaining: 0,
        videosRemaining: 0,
        woofsRemaining: 0
      });
      setLoading(false);
      return;
    }

    try {
      // Get active brand from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active_brand_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile?.active_brand_id) {
        // No active brand - use default values
        setQuota({
          brandId: null,
          brandName: null,
          imagesUsed: 0,
          quotaImages: 0,
          videosUsed: 0,
          quotaVideos: 0,
          woofsUsed: 0,
          quotaWoofs: 0,
          canGenerateImage: false,
          canGenerateVideo: false,
          imagesRemaining: 0,
          videosRemaining: 0,
          woofsRemaining: 0
        });
        setLoading(false);
        return;
      }

      // Get brand quota
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name, images_used, quota_images, videos_used, quota_videos, woofs_used, quota_woofs')
        .eq('id', profile.active_brand_id)
        .single();

      if (brandError) throw brandError;

      const imagesUsed = brand?.images_used || 0;
      const quotaImages = brand?.quota_images || 0;
      const videosUsed = brand?.videos_used || 0;
      const quotaVideos = brand?.quota_videos || 0;
      const woofsUsed = brand?.woofs_used || 0;
      const quotaWoofs = brand?.quota_woofs || 0;

      setQuota({
        brandId: brand?.id || null,
        brandName: brand?.name || null,
        imagesUsed,
        quotaImages,
        videosUsed,
        quotaVideos,
        woofsUsed,
        quotaWoofs,
        canGenerateImage: imagesUsed < quotaImages,
        canGenerateVideo: videosUsed < quotaVideos,
        imagesRemaining: Math.max(0, quotaImages - imagesUsed),
        videosRemaining: Math.max(0, quotaVideos - videosUsed),
        woofsRemaining: Math.max(0, quotaWoofs - woofsUsed)
      });
    } catch (error) {
      console.error('Error loading brand quota:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const refresh = useCallback(() => {
    return loadQuota();
  }, [loadQuota]);

  return {
    quota,
    loading,
    refresh
  };
}
