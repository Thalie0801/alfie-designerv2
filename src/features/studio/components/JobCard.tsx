import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import type { JobEntry } from "../types";

type NormalizedStatus = "queued" | "running" | "done" | "error" | "unknown";

const STATUS_MAP: Record<NormalizedStatus, { label: string; badgeClass: string; icon?: ComponentType<{ className?: string }> }> = {
  queued: {
    label: "En attente",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
    icon: Clock,
  },
  running: {
    label: "En cours",
    badgeClass: "bg-sky-100 text-sky-700 border border-sky-200",
    icon: Loader2,
  },
  done: {
    label: "Terminé",
    badgeClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    icon: CheckCircle,
  },
  error: {
    label: "Erreur",
    badgeClass: "bg-red-100 text-red-700 border border-red-200",
    icon: AlertCircle,
  },
  unknown: {
    label: "Statut inconnu",
    badgeClass: "bg-secondary text-secondary-foreground",
  },
};

function normalizeStatus(status?: string | null): NormalizedStatus {
  if (!status) return "unknown";
  const value = status.toLowerCase();
  if (value === "pending" || value === "queued") return "queued";
  if (value === "processing" || value === "running") return "running";
  if (value === "done" || value === "completed" || value === "success") return "done";
  if (value === "failed" || value === "error") return "error";
  return "unknown";
}

interface JobCardProps {
  job: JobEntry;
  createdAt: string;
  onRetry?: (job: JobEntry) => void;
  isStuck?: boolean;
}

export function JobCard({ job, createdAt, onRetry, isStuck }: JobCardProps) {
  const normalized = normalizeStatus(job.status);
  const config = STATUS_MAP[normalized];
  const Icon = config.icon;
  const jobError = (job.error_message || job.error || "").toString().trim();
  const showRetry = Boolean(jobError && onRetry);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium capitalize">{job.type.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground">{createdAt}</p>
          {job.order_id && (
            <p className="text-xs text-muted-foreground">Commande #{job.order_id}</p>
          )}
          {isStuck && normalized === "queued" && (
            <p className="text-[11px] text-amber-600 font-medium">Bloqué depuis &gt; 10 min</p>
          )}
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "flex items-center gap-1 uppercase tracking-wide text-[11px]",
            config.badgeClass,
            normalized === "running" && "[&>svg]:animate-spin",
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {config.label}
        </Badge>
      </div>

      {jobError && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-red-600 truncate" title={jobError}>
            {jobError}
          </p>
          {showRetry ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onRetry?.(job)}
            >
              Retenter
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
