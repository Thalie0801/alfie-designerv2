import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { getAuthHeader } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';

export type QueueMonitorPayload = {
  ok: boolean;
  now: string;
  counts: { queued: number; running: number; failed: number; completed?: number; completed_24h?: number };
  backlogSeconds: number | null;
  stuck: { runningStuckCount: number; thresholdSec: number };
  recent: Array<{ id: string; type: string; status: string; error?: string | null; retry: string; updated_at: string }>;
  scope: 'user' | 'global';
};

export function useQueueMonitor(enabled: boolean) {
  const { user } = useAuth();
  const [data, setData] = useState<QueueMonitorPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchOnce = useMemo(() => async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeader();
      const { data, error } = await supabase.functions.invoke('queue-monitor', { headers });
      if (error) throw error;
      setData(data as QueueMonitorPayload);
    } catch (e: any) {
      setError(e?.message || 'Monitoring indisponible');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Première requête immédiate
    fetchOnce();

    // Intervalle toutes les 8s
    timerRef.current = window.setInterval(fetchOnce, 8000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [enabled, fetchOnce]);

  useEffect(() => {
    if (!enabled || !user?.id) return;

    const channel = supabase
      .channel('queue-monitor-user')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_queue', filter: `user_id=eq.${user.id}` },
        () => {
          // Sur tout événement, on rafraîchit rapidement
          fetchOnce();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, user?.id, fetchOnce]);

  return { data, loading, error } as const;
}
