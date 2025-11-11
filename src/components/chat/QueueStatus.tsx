import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";
import { QueueMonitorPayload } from "@/hooks/useQueueMonitor";
import { useMemo } from "react";

type Counts = {
  queued?: number;
  running?: number;
  failed?: number;
  completed?: number;
  completed_24h?: number;
};

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

function timeAgo(date: string | number | Date) {
  const d = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d) / 1000; // seconds
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

export function QueueStatus({ data }: { data: QueueMonitorPayload }) {
  const c: Counts = data.counts || {};
  const total = (c.queued ?? 0) + (c.running ?? 0) + (c.failed ?? 0) + (c.completed ?? 0);
  const backlogMin = data.backlogSeconds ? Math.max(0, Math.round((data.backlogSeconds as number) / 60)) : null;
  const stuckCount = data.stuck?.runningStuckCount ?? 0;
  const recent = data.recent ?? [];

  const stats = useMemo(() => {
    const completed = c.completed ?? 0;
    const failed = c.failed ?? 0;
    const successDen = completed + failed;
    const successRate = successDen > 0 ? completed / successDen : 0;

    const per24h = c.completed_24h ?? 0;
    const throughputPerHour = per24h / 24;

    return {
      successRate,
      throughputPerHour,
    };
  }, [c.completed, c.failed, c.completed_24h]);

  const bar = {
    q: pct(c.queued ?? 0, total),
    r: pct(c.running ?? 0, total),
    f: pct(c.failed ?? 0, total),
    d: pct(c.completed ?? 0, total),
  };

  return (
    <Card className="mx-4 mt-2 border shadow-sm bg-card">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <div className="font-medium">Suivi des jobs</div>

        <Badge variant="secondary">queued: {c.queued ?? 0}</Badge>
        <Badge variant="outline">running: {c.running ?? 0}</Badge>
        <Badge variant="destructive">failed: {c.failed ?? 0}</Badge>
        <Badge variant="default">24h: {c.completed_24h ?? 0}</Badge>

        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span title="Débit moyen sur 24h">⚡ {stats.throughputPerHour.toFixed(1)}/h</span>
          <span title="Taux de succès (complétés / (complétés + échecs))">
            ✅ {(stats.successRate * 100).toFixed(0)}%
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {backlogMin !== null ? `plus ancien: ${backlogMin} min` : "n/a"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1",
              stuckCount > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground",
            )}
            title="Jobs running potentiellement bloqués"
          >
            <AlertTriangle className="h-3 w-3" />
            stuck: {stuckCount}
          </span>
        </div>
      </div>

      {/* Segmented progress */}
      {total > 0 && (
        <div className="px-3 pb-2">
          {/* Progress (global pour a11y) */}
          <Progress
            value={Math.min(100, pct(c.completed ?? 0, total))}
            className="h-0 opacity-0 pointer-events-none absolute -z-10"
            aria-label="Progression globale (complétés / total)"
          />
          {/* Segmented bar */}
          <div className="h-2 w-full rounded overflow-hidden flex" role="group" aria-label="Répartition des jobs">
            <div
              className="h-full bg-muted"
              style={{ width: `${bar.q}%` }}
              title={`Queued: ${c.queued ?? 0}`}
              aria-label={`Queued ${c.queued ?? 0}`}
            />
            <div
              className="h-full bg-blue-500/70"
              style={{ width: `${bar.r}%` }}
              title={`Running: ${c.running ?? 0}`}
              aria-label={`Running ${c.running ?? 0}`}
            />
            <div
              className="h-full bg-red-500/70"
              style={{ width: `${bar.f}%` }}
              title={`Failed: ${c.failed ?? 0}`}
              aria-label={`Failed ${c.failed ?? 0}`}
            />
            <div
              className="h-full bg-emerald-500/80"
              style={{ width: `${bar.d}%` }}
              title={`Completed: ${c.completed ?? 0}`}
              aria-label={`Completed ${c.completed ?? 0}`}
            />
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded bg-muted" />
              queued
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded bg-blue-500/70" />
              running
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded bg-red-500/70" />
              failed
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded bg-emerald-500/80" />
              completed
            </span>
          </div>
        </div>
      )}

      {/* Recent jobs */}
      {recent.length > 0 && (
        <div className="px-3 pb-3">
          <div className="text-xs text-muted-foreground mb-2">Derniers jobs</div>
          <ul className="space-y-1 text-xs">
            {recent.slice(0, 5).map((j) => (
              <li key={j.id} className="flex justify-between gap-2">
                <span className="truncate max-w-[50%]" title={j.type}>
                  {j.type}
                </span>
                <span className="opacity-80" title="Statut">
                  {j.status}
                </span>
                <span className="opacity-60" title={new Date(j.updated_at).toLocaleString()}>
                  {timeAgo(j.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
