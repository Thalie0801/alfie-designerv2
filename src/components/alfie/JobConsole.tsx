import * as React from 'react';
import { useJobs } from '@/hooks/useJobs';
import type { Job, JobEvent } from '@/lib/types/alfie';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, AlertTriangle, Loader2, Timer, Activity } from 'lucide-react';

type Props = {
  orderId: string | null;
  className?: string;
};

const KIND_ORDER: ReadonlyArray<Job['kind']> = ['copy', 'vision', 'render', 'upload', 'thumb', 'publish'];

export function JobConsole({ orderId, className }: Props) {
  const { jobs, events, loading } = useJobs(orderId);

  const sortedJobs = React.useMemo(() => {
    if (!jobs.length) return jobs;
    return [...jobs].sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a.kind);
      const bi = KIND_ORDER.indexOf(b.kind);
      if (ai !== -1 && bi !== -1 && ai !== bi) {
        return ai - bi;
      }
      return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    });
  }, [jobs]);

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Pipeline
            </CardTitle>
            {loading ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </Badge>
            ) : (
              <Badge variant="outline">{sortedJobs.length} job(s)</Badge>
            )}
          </CardHeader>
          <CardContent>
            {orderId == null ? (
              <p className="text-sm text-muted-foreground">Aucun order sélectionné.</p>
            ) : sortedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun job trouvé pour cet order (encore en « draft » ?).
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <StepIcon status={job.status} />
                      <div>
                        <div className="text-sm font-medium capitalize">{job.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={job.status} />
                      {job.attempt > 0 ? (
                        <Badge variant="destructive" className="whitespace-nowrap">
                          retry ×{job.attempt}
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Logs temps réel
            </CardTitle>
            <Badge variant="outline">{events.length} event(s)</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-3">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun event pour le moment. Dès que le worker avance, les logs s’affichent ici.
                </p>
              ) : (
                <ul className="space-y-2">
                  {events.map((ev) => (
                    <li key={`${ev.id}`} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <EventLevelBadge level={ev.level} />
                          <div className="text-sm">{ev.message}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      {ev.meta ? (
                        <>
                          <Separator className="my-2" />
                          <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {JSON.stringify(ev.meta, null, 2)}
                          </pre>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<
    Job['status'],
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    queued: { label: 'queued', variant: 'secondary' },
    retry: { label: 'retry', variant: 'destructive' },
    running: { label: 'running', variant: 'outline' },
    done: { label: 'done', variant: 'default' },
    error: { label: 'error', variant: 'destructive' },
  };
  const cfg = map[status] ?? map.queued;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StepIcon({ status }: { status: Job['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === 'error') return <AlertTriangle className="h-5 w-5 text-red-600" />;
  if (status === 'running') return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
  if (status === 'retry') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <Timer className="h-5 w-5 text-muted-foreground" />;
}

function EventLevelBadge({ level }: { level: JobEvent['level'] }) {
  const map: Record<JobEvent['level'], { label: string; className: string }> = {
    debug: { label: 'debug', className: 'bg-slate-100 text-slate-700' },
    info: { label: 'info', className: 'bg-blue-100 text-blue-700' },
    warn: { label: 'warn', className: 'bg-amber-100 text-amber-700' },
    error: { label: 'error', className: 'bg-red-100 text-red-700' },
  };
  const cfg = map[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export default JobConsole;
