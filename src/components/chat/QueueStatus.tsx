import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { QueueMonitorPayload } from '@/hooks/useQueueMonitor';

export function QueueStatus({ data }: { data: QueueMonitorPayload }) {
  const c = data.counts || ({} as any);
  const total = (c.queued ?? 0) + (c.running ?? 0) + (c.failed ?? 0) + (c.completed ?? 0);
  const backlogMin = data.backlogSeconds ? Math.max(0, Math.round(data.backlogSeconds / 60)) : null;

  return (
    <Card className="mx-4 mt-2 border shadow-sm bg-card">
      <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <div className="font-medium">Suivi des jobs</div>
        <Badge variant="secondary">queued: {c.queued ?? 0}</Badge>
        <Badge variant="outline">running: {c.running ?? 0}</Badge>
        <Badge variant="destructive">failed: {c.failed ?? 0}</Badge>
        <Badge variant="default">24h: {c.completed_24h ?? 0}</Badge>
        <div className="text-muted-foreground ml-auto">
          {backlogMin !== null ? `⏱️ plus ancien: ${backlogMin} min` : '⏱️ n/a'} · stuck: {data.stuck?.runningStuckCount ?? 0}
        </div>
      </div>
      {total > 0 && (
        <div className="px-3 pb-3">
          <Progress value={Math.min(100, ((c.completed ?? 0) / total) * 100)} />
        </div>
      )}
      {data.recent?.length ? (
        <div className="px-3 pb-3">
          <div className="text-xs text-muted-foreground mb-2">Derniers jobs</div>
          <ul className="space-y-1 text-xs">
            {data.recent.slice(0, 5).map((j) => (
              <li key={j.id} className="flex justify-between">
                <span className="truncate max-w-[60%]">{j.type}</span>
                <span className="opacity-80">{j.status}</span>
                <span className="opacity-60">{new Date(j.updated_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
