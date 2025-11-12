import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X, Clock, CheckCircle2, AlertCircle, type LucideIcon, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";

export type JobStatus =
  | "queued"
  | "running"
  | "processing"
  | "checking"
  | "ready"
  | "completed"
  | "failed"
  | "canceled";

interface JobPlaceholderProps {
  jobId: string;
  shortId?: string;
  status: JobStatus;
  progress?: number; // 0–100
  type: "image" | "video";
  onCancel?: () => void;
  onRetry?: () => void; // bouton réessayer si failed
  /** Optionnel: ETA en secondes restantes (affiché quand pertinent) */
  etaSeconds?: number;
  /** Optionnel: version compacte (densité + petites paddings) */
  compact?: boolean;
}

type StatusConf = {
  icon: LucideIcon;
  label: string;
  colorClass: string;
  bgClass: string;
  spinning?: boolean;
};

const statusConfig: Record<JobStatus, StatusConf> = {
  queued: {
    icon: Clock,
    label: "En file",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
  },
  running: {
    icon: Loader2,
    label: "En génération",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950",
    spinning: true,
  },
  processing: {
    icon: Loader2,
    label: "En génération",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950",
    spinning: true,
  },
  checking: {
    icon: Loader2,
    label: "Vérification",
    colorClass: "text-purple-500",
    bgClass: "bg-purple-50 dark:bg-purple-950",
    spinning: true,
  },
  ready: {
    icon: CheckCircle2,
    label: "Prête",
    colorClass: "text-green-500",
    bgClass: "bg-green-50 dark:bg-green-950",
  },
  completed: {
    icon: CheckCircle2,
    label: "Prête",
    colorClass: "text-green-500",
    bgClass: "bg-green-50 dark:bg-green-950",
  },
  failed: {
    icon: AlertCircle,
    label: "Échec",
    colorClass: "text-destructive",
    bgClass: "bg-destructive/10",
  },
  canceled: {
    icon: X,
    label: "Annulé",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
  },
};

function clampPct(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function formatEta(sec?: number): string | null {
  if (!sec || sec <= 0) return null;
  if (sec < 60) return `${Math.ceil(sec)}s restantes`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m restantes`;
  }
  return `${m}m ${s}s restantes`;
}

export function JobPlaceholder({
  jobId,
  shortId,
  status,
  progress = 0,
  type,
  onCancel,
  onRetry,
  etaSeconds,
  compact = false,
}: JobPlaceholderProps) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  const pct = clampPct(progress);

  const isActive = status === "running" || status === "processing" || status === "checking";
  const canCancel = status === "queued" || status === "running" || status === "processing";
  const isDone = status === "ready" || status === "completed";
  const isFailed = status === "failed";

  const displayShortId = shortId || `${jobId.slice(0, 4).toUpperCase()}…${jobId.slice(-4).toUpperCase()}`;

  const etaText = useMemo(() => formatEta(etaSeconds), [etaSeconds]);

  return (
    <Card className={`${cfg.bgClass} border-2`} role="status" aria-live="polite" aria-atomic="true">
      <CardHeader className={compact ? "pb-2 py-2" : "pb-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className={`${compact ? "text-sm" : "text-base"} flex items-center gap-2`}>
            <Icon className={`h-5 w-5 ${cfg.colorClass} ${cfg.spinning ? "animate-spin" : ""}`} aria-hidden="true" />
            {type === "video" ? "Vidéo" : "Image"} {isDone ? "prête ✅" : isFailed ? "en échec" : "en cours…"}
          </CardTitle>
          <Badge variant="outline" className="text-xs select-all">
            {displayShortId}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className={`space-y-3 ${compact ? "pt-0" : ""}`}>
        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`${cfg.colorClass} bg-transparent border ${compact ? "text-[11px] px-2 py-0.5" : ""}`}>
            {cfg.label}
          </Badge>
          {etaText && isActive && <span className="text-xs text-muted-foreground">{etaText}</span>}
        </div>

        {/* Progress */}
        {isActive && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progression</span>
              <span>{pct}%</span>
            </div>
            <Progress
              value={pct}
              className={compact ? "h-1.5" : "h-2"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Progression de la génération"
            />
          </div>
        )}

        {/* Info longue / file d'attente */}
        {status === "queued" && (
          <p className="text-xs text-muted-foreground">🕒 En file d’attente — démarrage imminent.</p>
        )}
        {(status === "running" || status === "processing") && pct === 0 && (
          <p className="text-xs text-muted-foreground">⏳ Génération en cours, cela peut prendre un petit moment…</p>
        )}
        {status === "checking" && <p className="text-xs text-muted-foreground">🔍 Vérification & post-traitement…</p>}

        {/* Actions */}
        <div className="grid grid-cols-1 gap-2">
          {isFailed && (
            <>
              <p className="text-xs text-destructive">
                La génération a échoué. Réessayez ou contactez le support si le problème persiste.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {onRetry && (
                  <Button variant="outline" size={compact ? "sm" : "default"} onClick={onRetry}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Re-générer
                  </Button>
                )}
                {onCancel && (
                  <Button variant="ghost" size={compact ? "sm" : "default"} onClick={onCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Fermer
                  </Button>
                )}
              </div>
            </>
          )}

          {!isFailed && canCancel && onCancel && (
            <Button variant="ghost" size={compact ? "sm" : "default"} onClick={onCancel} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
