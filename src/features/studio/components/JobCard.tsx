import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { JobEntry } from "../types";

type NormalizedStatus = "queued" | "running" | "done" | "error" | "unknown";

const STATUS_MAP: Record<
  NormalizedStatus,
  {
    label: string;
    badgeClass: string;
    icon?: ComponentType<{ className?: string; size?: number }>;
    iconClassName?: string;
  }
> = {
  queued: {
    label: "En attente",
    badgeClass: "inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs",
    icon: Clock,
  },
  running: {
    label: "En cours",
    badgeClass: "inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs",
    icon: Loader2,
    iconClassName: "animate-spin",
  },
  done: {
    label: "Terminé",
    badgeClass: "inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs",
    icon: CheckCircle2,
  },
  error: {
    label: "Erreur",
    badgeClass: "inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-xs",
    icon: AlertCircle,
  },
  unknown: {
    label: "Statut inconnu",
    badgeClass: "inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-xs",
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Commande #{job.order_id}</span>
              <Link to={`/library?order=${job.order_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink size={14} /> Voir
              </Link>
            </div>
          )}
          {isStuck && normalized === "queued" && (
            <p className="text-[11px] text-amber-600 font-medium">Bloqué depuis &gt; 10 min</p>
          )}
        </div>
        <span className={config.badgeClass}>
          {Icon ? <Icon size={14} className={config.iconClassName} /> : null}
          {config.label}
        </span>
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
