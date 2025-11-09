import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { Dict } from '@/types/safe';

type FeatureFlag = {
  enabled: boolean;
  allowed_plans: string[] | null;
  allowed_roles: string[] | null;
};

export function useFeatureFlags() {
  const [flags, setFlags] = useState<Dict<FeatureFlag>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlags();
  }, []);

  async function loadFlags() {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('enabled', true);

    if (error) {
      console.error('[FeatureFlags] Error loading flags:', error);
      setLoading(false);
      return;
    }

    const flagsMap = (data ?? []).reduce<Dict<FeatureFlag>>((acc, flag) => {
      if (!flag || typeof flag.feature !== 'string') {
        return acc;
      }

      acc[flag.feature] = {
        enabled: Boolean(flag.enabled),
        allowed_plans: Array.isArray(flag.allowed_plans)
          ? (flag.allowed_plans as string[])
          : null,
        allowed_roles: Array.isArray(flag.allowed_roles)
          ? (flag.allowed_roles as string[])
          : null,
      };
      return acc;
    }, {});

    setFlags(flagsMap);
    setLoading(false);
  }

  return { flags, loading };
}
