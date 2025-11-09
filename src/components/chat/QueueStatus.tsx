import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import type { QueueMonitorCounts } from "@/hooks/useQueueMonitor";

type QueueStatusProps = QueueMonitorCounts & { className?: string };

export function QueueStatus({ queued, running, done24h, className }: QueueStatusProps) {
  return (
    <Card className={`mx-4 mt-2 border shadow-sm bg-card ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-4 p-3 text-sm">
        <div className="font-medium">Suivi des jobs</div>
        <Badge variant="secondary">queued: {queued}</Badge>
        <Badge variant="outline">running: {running}</Badge>
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          24h: {done24h}
        </Badge>
        <div className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Rafraîchi automatiquement
        </div>
      </div>
    </Card>
  );
}
