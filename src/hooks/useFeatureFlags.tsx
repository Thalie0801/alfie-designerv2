import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, any>>({});
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

    const flagsMap = (data || []).reduce((acc, flag) => {
      acc[flag.feature] = {
        enabled: flag.enabled,
        allowed_plans: flag.allowed_plans,
        allowed_roles: flag.allowed_roles,
      };
      return acc;
    }, {} as Record<string, any>);

    setFlags(flagsMap);
    setLoading(false);
  }

  return { flags, loading };
}
