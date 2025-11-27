import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

interface AffiliateData {
  id: string;
  affiliate_status: 'creator' | 'mentor' | 'leader' | null;
  active_direct_referrals: number | null;
}

export function useAffiliateStatus() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadAffiliate();
  }, [user]);

  const loadAffiliate = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('affiliates')
        .select('id, affiliate_status, active_direct_referrals')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setAffiliate(data as AffiliateData);
      }
    } catch (error) {
      console.error('Error loading affiliate status:', error);
    } finally {
      setLoading(false);
    }
  };

  return { affiliate, loading };
}
