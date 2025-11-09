import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { useAuth } from '@/hooks/useAuth';
import { safeString } from '@/lib/safeRender';

export interface BrandKit {
  id?: string;
  name?: string;
  palette: string[];
  logo_url?: string;
  fonts?: {
    primary?: string;
    secondary?: string;
  };
  voice?: string;
  niche?: string;
}

interface Brand {
  id: string;
  name: string;
  user_id: string;
  palette: any; // Json type from Supabase
  logo_url?: string;
  fonts?: any;
  voice?: string;
  canva_connected: boolean;
  created_at: string | null;
}

export function useBrandKit() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadBrands();
    }
  }, [user]);

  const loadBrands = async () => {
    if (!user) return;
    
    try {
      // Load all brands for this user
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (brandsError) throw brandsError;
      
      // Transform null to undefined for TypeScript compatibility
      const transformedBrands = (brandsData || []).map(brand => ({
        ...brand,
        name: safeString(brand.name),
        logo_url: brand.logo_url ?? undefined,
        voice: brand.voice ?? undefined,
        palette: Array.isArray(brand.palette) ? brand.palette : [],
        canva_connected: Boolean(brand.canva_connected)
      }));
      setBrands(transformedBrands);

      // Load active brand from profile or use first brand
      const { data: profileData } = await supabase
        .from('profiles')
        .select('active_brand_id')
        .eq('id', user.id)
        .single();

      const activeId = profileData?.active_brand_id || brandsData?.[0]?.id || null;
      setActiveBrandId(activeId);

      // Update profile if no active brand set but brands exist
      if (!profileData?.active_brand_id && brandsData?.length) {
        await supabase
          .from('profiles')
          .update({ active_brand_id: brandsData[0].id })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const setActiveBrand = async (brandId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active_brand_id: brandId })
        .eq('id', user.id);

      if (error) throw error;
      
      setActiveBrandId(brandId);
    } catch (error) {
      console.error('Error setting active brand:', error);
      throw error;
    }
  };

  const activeBrand = brands.find(b => b.id === activeBrandId);
  
  // Convert active brand to BrandKit format for backward compatibility
  const brandKit: BrandKit | null = activeBrand ? {
    id: activeBrand.id,
    name: activeBrand.name,
    palette: Array.isArray(activeBrand.palette) ? activeBrand.palette : [],
    logo_url: activeBrand.logo_url,
    fonts: activeBrand.fonts,
    voice: activeBrand.voice,
    niche: (activeBrand as any).niche
  } : null;

  const canAddBrand = () => {
    // Limiter à 1 seule marque
    return brands.length < 1;
  };

  const remainingBrands = () => {
    // Toujours 1 marque maximum
    return Math.max(0, 1 - brands.length);
  };

  return {
    // Current active brand (backward compatible)
    brandKit,
    hasBrandKit: !!brandKit,
    
    // Multi-brand management
    brands,
    activeBrandId,
    activeBrand,
    setActiveBrand,
    loadBrands,
    
    // Quota management (limité à 1 marque)
    canAddBrand: canAddBrand(),
    remainingBrands: remainingBrands(),
    totalBrands: brands.length,
    quotaBrands: 1, // Limité à 1 marque
    
    loading,
    
    // Deprecated methods (kept for backward compatibility)
    updateBrandKit: () => {
      console.warn('updateBrandKit is deprecated, use BrandDialog instead');
    },
    clearBrandKit: () => {
      console.warn('clearBrandKit is deprecated');
    }
  };
}
