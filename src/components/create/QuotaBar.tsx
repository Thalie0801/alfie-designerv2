import { useState, useEffect, useMemo } from "react";
import { callEdge } from "@/lib/edgeClient";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuotaData {
  woofs_quota: number;
  woofs_used: number;
  woofs_remaining: number;
  visuals_quota: number;
  visuals_used: number;
  visuals_remaining: number;
  videos_quota: number;
  videos_used: number;
  videos_remaining: number;
  plan: string;
  reset_date: string | null;
}

interface QuotaBarProps {
  activeBrandId: string | null;
}

function clampPct(n: number) {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pct(used: number, quota: number) {
  if (!quota || quota <= 0) return 0;
  return clampPct((used / quota) * 100);
}

function colorFor(percent: number) {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

function textTone(percent: number) {
  if (percent >= 90) return "text-destructive";
  if (percent >= 70) return "text-accent";
  return "text-muted-foreground";
}

function formatReset(date: string | null) {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function QuotaBar({ activeBrandId }: QuotaBarProps) {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isVideoBackendAvailable = Boolean((import.meta as any)?.env?.VITE_FFMPEG_BACKEND_URL);

  useEffect(() => {
    let mounted = true;
    const fetchQuota = async () => {
      if (!activeBrandId) {
        if (mounted) {
          setQuota(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await callEdge("get-quota", { brand_id: activeBrandId }, { silent: true });

        if (!result?.ok) {
          throw new Error(result?.error || "Erreur de chargement des quotas");
        }
        if (mounted) setQuota(result.data as QuotaData);
      } catch (err: any) {
        console.error("Error fetching quota:", err);
        if (mounted) setError(err?.message || "Erreur de chargement des quotas");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchQuota();
    return () => {
      mounted = false;
    };
  }, [activeBrandId]);

  const visualsPercent = useMemo(() => pct(quota?.visuals_used ?? 0, quota?.visuals_quota ?? 0), [quota]);
  const videosPercent = useMemo(() => pct(quota?.videos_used ?? 0, quota?.videos_quota ?? 0), [quota]);
  const woofsPercent = useMemo(() => pct(quota?.woofs_used ?? 0, quota?.woofs_quota ?? 0), [quota]);

  if (loading) {
    return (
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    );
  }

  if (error || !quota) {
    return (
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{error || "Aucune marque active"}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="h-7 px-2">
            <RefreshCcw className="h-3.5 w-3.5 mr-1" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const visualsLeft = Math.max(0, quota.visuals_remaining ?? 0);
  const videosLeft = Math.max(0, quota.videos_remaining ?? 0);
  const woofsLeft = Math.max(0, quota.woofs_remaining ?? 0);

  const visualsQuota = Math.max(0, quota.visuals_quota ?? 0);
  const videosQuota = Math.max(0, quota.videos_quota ?? 0);
  const woofsQuota = Math.max(0, quota.woofs_quota ?? 0);

  return (
    <details className="sticky top-0 z-30 bg-gradient-to-r from-background via-background/98 to-background backdrop-blur-xl border-b border-border/50 shadow-sm group">
      <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-all duration-200 list-none">
        <div className="flex items-center gap-3">
          {/* Badge Visuels */}
          <div className="flex flex-col gap-1 min-w-[88px]">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 text-sm font-semibold border border-blue-200 dark:border-blue-800 shadow-sm",
                textTone(visualsPercent),
              )}
              title="Visuels IA"
            >
              <span className="text-xs" aria-hidden>
                📸
              </span>
              <span className="text-xs">{visualsQuota ? `${visualsLeft}/${visualsQuota}` : "—/0"}</span>
            </div>
            <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-500", colorFor(visualsPercent))}
                style={{ width: `${visualsPercent}%` }}
              />
            </div>
          </div>

          {/* Badge Vidéos */}
          <div className="flex flex-col gap-1 min-w-[88px]">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 text-sm font-semibold border border-purple-200 dark:border-purple-800 shadow-sm",
                textTone(videosPercent),
                !isVideoBackendAvailable && "opacity-60",
              )}
              title={isVideoBackendAvailable ? "Vidéos IA" : "Vidéos IA (backend inactif)"}
            >
              <span className="text-xs" aria-hidden>
                🎬
              </span>
              <span className="text-xs">
                {isVideoBackendAvailable ? (videosQuota ? `${videosLeft}/${videosQuota}` : "—/0") : "désactivé"}
              </span>
            </div>
            <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isVideoBackendAvailable ? colorFor(videosPercent) : "bg-gray-300 dark:bg-gray-600",
                )}
                style={{ width: `${isVideoBackendAvailable ? videosPercent : 0}%` }}
              />
            </div>
          </div>

          {/* Badge Woofs */}
          <div className="flex flex-col gap-1 min-w-[88px]">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 text-sm font-semibold border border-orange-200 dark:border-orange-800 shadow-sm",
                textTone(woofsPercent),
              )}
              title="Budget vidéo (Woofs)"
            >
              <span className="text-xs" aria-hidden>
                🐾
              </span>
              <span className="text-xs">{woofsQuota ? `${woofsLeft}/${woofsQuota}` : "—/0"}</span>
            </div>
            <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-500", colorFor(woofsPercent))}
                style={{ width: `${woofsPercent}%` }}
              />
            </div>
          </div>

          {/* Badge mode Cloudinary-only si backend absent */}
          {!isVideoBackendAvailable && (
            <span
              className="ml-2 hidden sm:inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              title="Backend vidéo IA non configuré — montage Cloudinary seulement"
            >
              Cloudinary-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md"
            title="Date de réinitialisation des quotas"
          >
            Reset : {formatReset(quota.reset_date)}
          </span>
          <span
            className="text-xs text-muted-foreground group-open:rotate-180 transition-transform duration-200"
            aria-hidden
          >
            ▼
          </span>
        </div>
      </summary>

      <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border bg-muted/30">
        <div className="py-3 space-y-2">
          <p className="font-medium text-foreground">💡 Astuces pour économiser tes quotas</p>
          <ul className="space-y-1 text-xs">
            <li>
              • <span className="font-medium">Draft 10s</span> : Version vidéo courte et économique (1 Woof)
            </li>
            <li>
              • <span className="font-medium">Batch de nuit</span> : Génère plusieurs assets d’un coup
            </li>
            <li>
              • <span className="font-medium">Templates Canva</span> : Adaptation gratuite avec ton Brand Kit
            </li>
          </ul>
          <p className="text-xs pt-1">
            Les quotas se réinitialisent le 1er de chaque mois. Plan actuel :{" "}
            <span className="font-semibold text-foreground">{quota.plan || "—"}</span>
          </p>
          {!isVideoBackendAvailable && (
            <p className="text-xs pt-1 text-amber-700">
              🎥 Backend vidéo IA non configuré : les <strong>montages Cloudinary</strong> (images → vidéo, concat,
              overlays) restent disponibles et ne consomment pas le quota “Vidéos IA”.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
