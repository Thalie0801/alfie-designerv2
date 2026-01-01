import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import {
  SubjectPack,
  CreateSubjectPackInput,
  listSubjectPacks,
  createSubjectPack,
  deleteSubjectPack,
  getSubjectPack,
} from '@/services/subjectPackService';

export function useSubjectPacks(brandId?: string) {
  const { user } = useAuth();
  const [packs, setPacks] = useState<SubjectPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setPacks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listSubjectPacks(brandId);
      setPacks(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error loading subject packs:', err);
    } finally {
      setLoading(false);
    }
  }, [user, brandId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPack = useCallback(async (
    input: CreateSubjectPackInput,
    files: { master: File; anchorA?: File; anchorB?: File }
  ) => {
    if (!user) throw new Error('Not authenticated');
    
    const newPack = await createSubjectPack(input, files, user.id);
    setPacks(prev => [newPack, ...prev]);
    return newPack;
  }, [user]);

  const deletePack = useCallback(async (id: string) => {
    await deleteSubjectPack(id);
    setPacks(prev => prev.filter(p => p.id !== id));
  }, []);

  const getPack = useCallback(async (id: string) => {
    return getSubjectPack(id);
  }, []);

  return {
    packs,
    loading,
    error,
    refresh,
    createPack,
    deletePack,
    getPack,
  };
}

/**
 * Hook to resolve the effective subject pack for a project
 * Based on toggle state and brand kit default
 */
export function useEffectiveSubjectPack(
  useDefaultFromBrandKit: boolean,
  selectedPackId: string | null
): { effectivePackId: string | null; loading: boolean } {
  const { brandKit, loading: brandKitLoading } = useBrandKit();
  const [effectivePackId, setEffectivePackId] = useState<string | null>(null);

  useEffect(() => {
    if (useDefaultFromBrandKit) {
      // Use the brand kit's default subject pack
      const defaultPackId = (brandKit as any)?.default_subject_pack_id || null;
      setEffectivePackId(defaultPackId);
    } else {
      // Use the manually selected pack
      setEffectivePackId(selectedPackId);
    }
  }, [useDefaultFromBrandKit, selectedPackId, brandKit]);

  return {
    effectivePackId,
    loading: brandKitLoading,
  };
}
