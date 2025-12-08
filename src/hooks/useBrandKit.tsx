import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { safeString } from '@/lib/safeRender';

export interface ToneSliders {
  fun: number;       // 0-10 (fun ↔ sérieux)
  accessible: number; // 0-10 (accessible ↔ corporate)
  energetic: number;  // 0-10 (énergique ↔ calme)
  direct: number;     // 0-10 (direct ↔ nuancé)
}

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
  
  // V2 - Identité enrichie
  pitch?: string;
  adjectives?: string[];
  
  // V2 - Voix & Ton
  tone_sliders?: ToneSliders;
  person?: 'je' | 'nous' | 'tu' | 'vous';
  language_level?: 'familier' | 'courant' | 'soutenu';
  
  // V2 - Style visuel
  visual_types?: string[];
  visual_mood?: string[];
  avoid_in_visuals?: string;
  text_color?: string; // ✅ V9: Couleur de texte pour overlays carrousels
  
  // Bonus
  tagline?: string;
}

interface Brand {
  id: string;
  name: string;
  user_id: string;
  palette: any;
  logo_url?: string | null;
  fonts?: any;
  voice?: string | null;
  niche?: string | null;
  pitch?: string | null;
  adjectives?: string[] | null;
  tone_sliders?: ToneSliders | null;
  person?: string | null;
  language_level?: string | null;
  visual_types?: string[] | null;
  visual_mood?: string[] | null;
  avoid_in_visuals?: string | null;
  text_color?: string | null; // ✅ V9: Couleur de texte
  tagline?: string | null;
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

  // Auto-création d'une marque par défaut si aucune n'existe
  useEffect(() => {
    const createDefaultBrand = async () => {
      if (!user || loading || brands.length > 0) return;

      try {
        console.log('[useBrandKit] No brand found, creating default brand...');
        
        // Récupérer le plan de l'utilisateur
        const { data: profileData } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single();

        const plan = profileData?.plan || 'starter';

        // Créer la marque par défaut
        const { data: newBrand, error: brandError } = await supabase
          .from('brands')
          .insert({
            user_id: user.id,
            name: 'Ma première marque',
            plan: plan,
            is_default: true,
            palette: ['#FF6B9D', '#C44569', '#8B4789'],
          })
          .select()
          .single();

        if (brandError) throw brandError;

        // Définir comme marque active
        await supabase
          .from('profiles')
          .update({ active_brand_id: newBrand.id })
          .eq('id', user.id);

        // Initialiser counters_monthly
        const now = new Date();
        const period = parseInt(
          now.getFullYear().toString() + 
          (now.getMonth() + 1).toString().padStart(2, '0')
        );

        await supabase.rpc('increment_monthly_counters', {
          p_brand_id: newBrand.id,
          p_period_yyyymm: period,
          p_images: 0,
          p_reels: 0,
          p_woofs: 0,
        });

        console.log('[useBrandKit] Default brand created successfully:', newBrand.id);
        
        // Recharger les marques
        await loadBrands();
      } catch (error) {
        console.error('[useBrandKit] Error creating default brand:', error);
      }
    };

    createDefaultBrand();
  }, [user, loading, brands.length]);

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
      const transformedBrands: Brand[] = (brandsData || []).map(brand => ({
        id: brand.id,
        name: safeString(brand.name),
        user_id: brand.user_id,
        palette: Array.isArray(brand.palette) ? brand.palette : [],
        logo_url: brand.logo_url ?? null,
        fonts: brand.fonts,
        voice: brand.voice ?? null,
        niche: brand.niche ?? null,
        pitch: brand.pitch ?? null,
        adjectives: brand.adjectives ?? null,
        tone_sliders: brand.tone_sliders ? brand.tone_sliders as unknown as ToneSliders : null,
        person: brand.person ?? null,
        language_level: brand.language_level ?? null,
        visual_types: brand.visual_types ?? null,
        visual_mood: brand.visual_mood ?? null,
        avoid_in_visuals: brand.avoid_in_visuals ?? null,
        tagline: brand.tagline ?? null,
        canva_connected: Boolean(brand.canva_connected),
        created_at: brand.created_at
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
    logo_url: activeBrand.logo_url ?? undefined,
    fonts: activeBrand.fonts,
    voice: activeBrand.voice ?? undefined,
    niche: activeBrand.niche ?? undefined,
    pitch: activeBrand.pitch ?? undefined,
    adjectives: activeBrand.adjectives ?? undefined,
    tone_sliders: activeBrand.tone_sliders ?? undefined,
    person: (activeBrand.person as BrandKit['person']) ?? undefined,
    language_level: (activeBrand.language_level as BrandKit['language_level']) ?? undefined,
    visual_types: activeBrand.visual_types ?? undefined,
    visual_mood: activeBrand.visual_mood ?? undefined,
    avoid_in_visuals: activeBrand.avoid_in_visuals ?? undefined,
    tagline: activeBrand.tagline ?? undefined
  } : null;

  // Get quota_brands from profile
  const [quotaBrands, setQuotaBrands] = useState<number>(1);

  useEffect(() => {
    const fetchQuotaBrands = async () => {
      if (!user) return;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('quota_brands')
        .eq('id', user.id)
        .single();
      
      if (profileData?.quota_brands) {
        setQuotaBrands(profileData.quota_brands);
      }
    };
    
    fetchQuotaBrands();
  }, [user]);

  const canAddBrand = () => {
    return brands.length < quotaBrands;
  };

  const remainingBrands = () => {
    return Math.max(0, quotaBrands - brands.length);
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
    
    // Quota management
    canAddBrand: canAddBrand(),
    remainingBrands: remainingBrands(),
    totalBrands: brands.length,
    quotaBrands: quotaBrands,
    
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
