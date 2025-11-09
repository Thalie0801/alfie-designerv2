import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

interface MetricState {
  orders: number | null;
  jobQueue: number | null;
  error?: string | null;
}

export default function DebugPage() {
  const { user, session, profile } = useAuth();
  const { activeBrandId, activeBrand } = useBrandKit();
  const supabase = useSupabase();
  const [metrics, setMetrics] = useState<MetricState>({ orders: null, jobQueue: null });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useMemo(
    () =>
      async function fetchMetricsInternal() {
        setLoading(true);
        setMetrics(prev => ({ ...prev, error: null }));
        try {
          const { count: ordersCount, error: ordersError, status: ordersStatus } = await supabase
            .from('orders')
            .select('*', { head: true, count: 'exact' });

          if (ordersError) {
            throw Object.assign(new Error(ordersError.message), { status: ordersStatus });
          }

          const { count: jobCount, error: jobError, status: jobStatus } = await supabase
            .from('job_queue')
            .select('*', { head: true, count: 'exact' });

          if (jobError) {
            throw Object.assign(new Error(jobError.message), { status: jobStatus });
          }

          setMetrics({ orders: ordersCount ?? 0, jobQueue: jobCount ?? 0, error: null });
          setLastUpdated(new Date());
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            typeof (error as { status?: number | string })?.status === 'number'
              ? (error as { status?: number }).status
              : undefined;

          const finalMessage =
            status === 401
              ? 'Accès refusé (401)' // Auth required
              : status === 403
                ? 'Requête interdite (403)'
                : message;

          setMetrics(prev => ({ ...prev, error: finalMessage }));
        } finally {
          setLoading(false);
        }
      },
    [supabase],
  );

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const sessionMeta = useMemo(
    () => ({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      sessionExpiresAt: session?.expires_at ?? null,
      hasProfile: Boolean(profile),
      activeBrandId,
    }),
    [activeBrandId, profile, session?.expires_at, user?.email, user?.id],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Debug rapide</h1>
        <p className="text-sm text-muted-foreground">
          Vue interne (admin) pour diagnostiquer les accès Supabase & règles RLS.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Session</CardTitle>
          {session ? (
            <Badge variant="outline">Active</Badge>
          ) : (
            <Badge variant="destructive">Aucune</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <DebugLine label="User ID" value={sessionMeta.userId ?? '—'} />
            <DebugLine label="Email" value={sessionMeta.email ?? '—'} />
            <DebugLine label="Expiration" value={sessionMeta.sessionExpiresAt ?? '—'} />
            <DebugLine label="Profil chargé" value={sessionMeta.hasProfile ? 'oui' : 'non'} />
            <DebugLine label="Brand active" value={activeBrand?.name ?? activeBrandId ?? '—'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>RLS Check</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void fetchMetrics()} disabled={loading}>
            {loading ? 'Chargement…' : 'Rafraîchir'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <MetricBadge label="orders" value={metrics.orders} loading={loading} />
            <MetricBadge label="job_queue" value={metrics.jobQueue} loading={loading} />
            {lastUpdated && (
              <Badge variant="secondary">Mis à jour {lastUpdated.toLocaleTimeString()}</Badge>
            )}
          </div>
          {metrics.error ? (
            <p className="text-destructive">
              {metrics.error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MetricBadge({ label, value, loading }: { label: string; value: number | null; loading: boolean }) {
  const isUnknown = value === null;
  return (
    <Badge
      variant="outline"
      className={cn('text-sm', loading ? 'opacity-60 animate-pulse' : undefined, isUnknown ? 'text-muted-foreground' : undefined)}
    >
      <span className="font-semibold mr-1">{label}</span>
      {loading ? '…' : isUnknown ? 'N/A' : value}
    </Badge>
  );
}
