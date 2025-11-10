import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { useAuth } from './useAuth';

interface VideoQuota {
  woofsTotal: number;
  woofsUsed: number;
  woofsRemaining: number;
  visualsTotal: number;
  visualsUsed: number;
  visualsRemaining: number;
  plan: string;
  resetDate: string | null;
  storageDays: number;
}

export function useVideoQuota() {
  const { user } = useAuth();
  const [quota, setQuota] = useState<VideoQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = async () => {
    if (!user) {
      setQuota(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke('get-credits');

      if (functionError) throw functionError;

      setQuota({
        woofsTotal: data.woofs_total,
        woofsUsed: data.woofs_used,
        woofsRemaining: data.woofs_remaining,
        visualsTotal: data.visuals_total,
        visualsUsed: data.visuals_used,
        visualsRemaining: data.visuals_remaining,
        plan: data.plan,
        resetDate: data.reset_date,
        storageDays: data.storage_days
      });
    } catch (err: any) {
      console.error('Error fetching quota:', err);
      setError(err.message || 'Failed to fetch quota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, [user]);

  return {
    quota,
    loading,
    error,
    refetch: fetchQuota
  };
}
