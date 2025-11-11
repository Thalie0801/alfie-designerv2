import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Play, Unlock, Trash2, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import {
  JOB_QUEUE_SELECT,
  inferKindFromType,
  normalizeStatus,
  getJobTypeLabel,
  type JobQueue,
  type JobQueueStats,
  type JobQueueStatus,
} from '@/lib/types/jobQueue';

const REFRESH_INTERVAL_MS = 5000;

export function JobQueueMonitor() {
  const [jobs, setJobs] = useState<JobQueue[]>([]);
  const [stats, setStats] = useState<JobQueueStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: jobsData, error: jobsError } = await supabase
        .from('job_queue')
        .select(JOB_QUEUE_SELECT)
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) throw jobsError;

      const normalized = (jobsData ?? []).map((job) => ({
        ...job,
        status: normalizeStatus(job.status as string),
        kind: job.kind ?? inferKindFromType(job.type as JobQueue['type']),
      })) as JobQueue[];

      setJobs(normalized);

      const { data: statsData, error: statsError } = await supabase
        .from('job_queue_stats')
        .select('*');

      if (statsError) throw statsError;
      setStats((statsData ?? []) as JobQueueStats[]);
    } catch (err) {
      console.error('Error fetching job queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const totalJobs = useMemo(() => stats.reduce((sum, item) => sum + item.count, 0), [stats]);

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(() => {
      void fetchData();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  const handleTriggerWorker = async () => {
    try {
      setProcessing(true);
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke<{
        success?: boolean;
        ok?: boolean;
        processed?: number;
        error?: string | null;
      }>('alfie-job-worker', {
        body: { trigger: 'admin-monitor' },
      });

      if (fnError) throw fnError;

      const response = data ?? {};

      if (response && typeof response === 'object') {
        const { success, ok, error: workerError, processed } = response;
        if (workerError && workerError.trim().length > 0) {
          throw new Error(workerError);
        }
        if (success === false || ok === false) {
          throw new Error('Worker reported a failure');
        }
        if (typeof processed === 'number') {
          window.alert(`${processed} job(s) traité(s)`);
        }
      }
      
      await fetchData();
    } catch (err) {
      console.error('Error triggering worker:', err);
      setError(err instanceof Error ? err.message : 'Failed to trigger worker');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlockStuck = async () => {
    try {
      setProcessing(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('unlock_stuck_jobs', { stuck_minutes: 5 });
      if (rpcError) throw rpcError;
      const count = Array.isArray(data) ? data.length : 0;
      window.alert(`${count} job(s) débloqué(s)`);
      await fetchData();
    } catch (err) {
      console.error('Error unlocking jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlock jobs');
    } finally {
      setProcessing(false);
    }
  };

  const handleFailExpired = async () => {
    try {
      setProcessing(true);
      setError(null);
      const confirm = window.confirm('Marquer tous les jobs de plus de 24h comme échoués ?');
      if (!confirm) {
        setProcessing(false);
        return;
      }
      const { data, error: rpcError } = await supabase.rpc('fail_expired_jobs', { max_age_hours: 24 });
      if (rpcError) throw rpcError;
      const count = Array.isArray(data) ? data.length : 0;
      window.alert(`${count} job(s) marqué(s) comme échoués`);
      await fetchData();
    } catch (err) {
      console.error('Error failing jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fail expired jobs');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: JobQueueStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: JobQueueStatus) => {
    const variants = {
      queued: 'outline' as const,
      running: 'default' as const,
      completed: 'secondary' as const,
      failed: 'destructive' as const,
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Queue Monitor</CardTitle>
              <CardDescription>Surveillance et gestion de la file d'attente des jobs</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="default" size="sm" onClick={handleTriggerWorker} disabled={processing}>
                <Play className="h-4 w-4 mr-2" />
                Forcer le traitement
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {stats.map((stat) => (
              <Card key={stat.status}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{stat.count}</p>
                      <p className="text-sm text-muted-foreground capitalize">{stat.status}</p>
                    </div>
                    {getStatusIcon(stat.status)}
                  </div>
                  {stat.retried_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">{stat.retried_count} retentative(s)</p>
                  )}
                  {stat.max_retries_reached > 0 && (
                    <p className="text-xs text-destructive mt-1">{stat.max_retries_reached} tentative(s) max atteinte(s)</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant="outline" size="sm" onClick={handleUnlockStuck} disabled={processing}>
              <Unlock className="h-4 w-4 mr-2" />
              Débloquer jobs stuck (&gt;5min)
            </Button>
            <Button variant="outline" size="sm" onClick={handleFailExpired} disabled={processing}>
              <Trash2 className="h-4 w-4 mr-2" />
              Nettoyer jobs expirés (&gt;24h)
            </Button>
            <Badge variant="outline" className="ml-auto">
              Total: {totalJobs}
            </Badge>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Jobs récents ({jobs.length}/{totalJobs})</h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Card key={job.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {getStatusIcon(job.status)}
                            <span>{getJobTypeLabel(job.type)}</span>
                            {getStatusBadge(job.status)}
                            {job.kind && (
                              <Badge variant="outline" className="text-xs">
                                {job.kind}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>ID: {job.id.slice(0, 8)}…</p>
                            {job.order_id && <p>Commande: {job.order_id.slice(0, 8)}…</p>}
                            <p>
                              Tentatives: {job.attempts}/{job.max_attempts}
                            </p>
                            <p>Créé: {new Date(job.created_at).toLocaleString('fr-FR')}</p>
                            <p>MAJ: {new Date(job.updated_at).toLocaleString('fr-FR')}</p>
                          </div>
                          {job.error && (
                            <Alert variant="destructive">
                              <AlertDescription className="text-xs">{job.error}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {jobs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Aucun job dans la queue
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
