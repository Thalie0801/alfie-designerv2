import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Loader2,
  Images,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PlayCircle,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface CarouselProgressCardProps {
  /** total & done restent pris en charge comme fallback si on ne passe pas jobSetId */
  total: number;
  done: number;
  items: Array<{ id: string; url: string; index: number }>;
  onDownloadZip?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  /** optionnel: si fourni, on charge/écoute les jobs de ce set pour un progress “réel” */
  jobSetId?: string;
}

type Status = "queued" | "running" | "succeeded" | "failed";

interface JobStatus {
  id: string;
  index: number;
  status: Status;
  error?: string | null;
  retry_count?: number | null;
}

const ASPECT_TO_CLASS: Record<string, string> = {
  "4:5": "aspect-[4/5]",
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

function isVideo(url: string) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

function cloudinaryPosterFromVideoUrl(url?: string | null): string | undefined {
  if (!url) return;
  const m = url.match(/(https?:\/\/res\.cloudinary\.com\/[^/]+)\/video\/upload\/(.+?)\/([^/]+)\.(mp4|mov|webm)/i);
  if (!m) return;
  const [, root, path, pid] = m;
  return `${root}/video/upload/so_1/${path}/${pid}.jpg`;
}

function aspectClassFromDimensionHint(url: string) {
  // heuristique simple si le nom de fichier contient des indices
  // par défaut : 4:5 (feed IG)
  if (/16x9|16-9|1920x1080/i.test(url)) return ASPECT_TO_CLASS["16:9"];
  if (/9x16|9-16|1080x1920/i.test(url)) return ASPECT_TO_CLASS["9:16"];
  if (/1x1|1-1|1080x1080/i.test(url)) return ASPECT_TO_CLASS["1:1"];
  return ASPECT_TO_CLASS["4:5"];
}

export function CarouselProgressCard({
  total,
  done,
  items,
  onDownloadZip,
  onRetry,
  onCancel,
  jobSetId,
}: CarouselProgressCardProps) {
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState<boolean>(Boolean(jobSetId));
  const [imgErrorIds, setImgErrorIds] = useState<Record<string, boolean>>({});
  const [posterErrorIds, setPosterErrorIds] = useState<Record<string, boolean>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // --- Charger les statuts si jobSetId fourni
  useEffect(() => {
    if (!jobSetId) {
      setLoadingStatuses(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingStatuses(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("id, index_in_set, status, error, retry_count, job_set_id")
        .eq("job_set_id", jobSetId)
        .order("index_in_set", { ascending: true });

      if (!cancelled) {
        if (error) {
          console.error("[CarouselProgress] load error:", error);
          setJobStatuses([]);
        } else {
          const rows = (data ?? []).map((j: any) => ({
            id: j.id as string,
            index: (j.index_in_set as number) ?? 0,
            status: (j.status as Status) ?? "queued",
            error: (j.error as string) ?? null,
            retry_count: (j.retry_count as number) ?? 0,
          }));
          setJobStatuses(rows);
        }
        setLoadingStatuses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobSetId]);

  // --- Realtime (insert/update/delete) sur jobs du jobSet
  useEffect(() => {
    if (!jobSetId) return;
    // cleanup canal précédent
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`jobs_js_${jobSetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `job_set_id=eq.${jobSetId}` },
        (payload) => {
          setJobStatuses((prev) => {
            const row: any = payload.new ?? payload.old;
            if (!row) return prev;
            const idx = prev.findIndex((j) => j.id === row.id);
            const next: JobStatus = {
              id: row.id,
              index: row.index_in_set ?? 0,
              status: (row.status as Status) ?? "queued",
              error: row.error ?? null,
              retry_count: row.retry_count ?? 0,
            };
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== row.id);
            }
            if (idx === -1) return [...prev, next].sort((a, b) => a.index - b.index);
            const mutated = [...prev];
            mutated[idx] = next;
            return mutated.sort((a, b) => a.index - b.index);
          });
        },
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [jobSetId]);

  // --- Progress computation
  const { progress, safeDone, safeTotal, isComplete } = useMemo(() => {
    // si on a des statuts via DB (jobSetId), on calcule depuis ceux-ci
    if (jobSetId && jobStatuses.length > 0) {
      const totalDb = jobStatuses.length;
      const doneDb = jobStatuses.filter((j) => j.status === "succeeded").length;
      const pct = totalDb === 0 ? 0 : Math.round((doneDb / totalDb) * 100);
      return {
        progress: pct,
        safeDone: doneDb,
        safeTotal: totalDb,
        isComplete: totalDb > 0 && doneDb >= totalDb,
      };
    }
    // fallback sur props (compat)
    const safeTotalProp = Math.max(0, total);
    const safeDoneProp = Math.min(done, safeTotalProp);
    const pct = safeTotalProp === 0 ? 0 : Math.round((safeDoneProp / safeTotalProp) * 100);
    return {
      progress: pct,
      safeDone: safeDoneProp,
      safeTotal: safeTotalProp,
      isComplete: safeDoneProp >= safeTotalProp && safeTotalProp > 0,
    };
  }, [jobSetId, jobStatuses, total, done]);

  const getStatusIcon = (index: number) => {
    // priorité: si item présent pour l'index → ok
    const hasAsset = items.some((item) => item.index === index);
    if (hasAsset) return <CheckCircle2 className="w-3 h-3 text-green-500" />;

    // sinon, basé sur DB si dispo
    const job = jobStatuses.find((j) => j.index === index);
    if (job?.status === "failed") return <XCircle className="w-3 h-3 text-red-500" />;
    if (job?.status === "running") return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
    if (job?.status === "queued") return <div className="w-3 h-3 rounded-full border-2 border-muted" />;
    return <div className="w-3 h-3 rounded-full border-2 border-muted" />;
  };

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isComplete ? (
              <Loader2 className={cn("w-4 h-4 text-primary", (loadingStatuses || progress < 100) && "animate-spin")} />
            ) : (
              <span>✅</span>
            )}
            <span className="text-sm font-medium">{isComplete ? "Carrousel terminé" : "Génération en cours…"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {safeDone}/{safeTotal} ({progress}%)
            </span>

            {!isComplete && (
              <button
                onClick={() => {
                  if (jobSetId) {
                    // reload statuts côté DB
                    supabase
                      .from("jobs")
                      .select("id, index_in_set, status, error, retry_count")
                      .eq("job_set_id", jobSetId)
                      .order("index_in_set", { ascending: true })
                      .then(({ data }) => {
                        setJobStatuses(
                          (data ?? []).map((j: any) => ({
                            id: j.id,
                            index: j.index_in_set ?? 0,
                            status: (j.status as Status) ?? "queued",
                            error: j.error ?? null,
                            retry_count: j.retry_count ?? 0,
                          })),
                        );
                      });
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-muted-foreground/20 hover:bg-muted/60 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Refresh
              </button>
            )}

            {isComplete && onDownloadZip ? (
              <button
                onClick={onDownloadZip}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Télécharger le ZIP
              </button>
            ) : null}

            {!isComplete && typeof onRetry === "function" ? (
              <button
                onClick={onRetry}
                className="text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                Relancer le traitement
              </button>
            ) : null}

            {!isComplete && typeof onCancel === "function" ? (
              <button
                onClick={onCancel}
                className="text-xs px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Annuler
              </button>
            ) : null}
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-2" />

        {/* Empty state */}
        {items.length === 0 && !isComplete && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Images className="w-4 h-4" /> En attente des premières images…
          </div>
        )}

        {/* Assets grid */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
            {items
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((item) => {
                const video = isVideo(item.url);
                const aspectCls = aspectClassFromDimensionHint(item.url);
                const job = jobStatuses.find((j) => j.index === item.index);
                const poster = !posterErrorIds[item.id] && video ? cloudinaryPosterFromVideoUrl(item.url) : undefined;

                return (
                  <figure
                    key={item.id}
                    className="relative rounded-lg overflow-hidden border border-primary/10 group hover:border-primary/30 transition-colors bg-muted"
                  >
                    <div className={cn("relative w-full", aspectCls)}>
                      {video ? (
                        <>
                          <video
                            src={item.url}
                            poster={poster}
                            className="absolute inset-0 w-full h-full object-cover"
                            controls
                            playsInline
                            onError={() => setPosterErrorIds((s) => ({ ...s, [item.id]: true }))}
                          />
                          {!poster && (
                            <div className="absolute inset-0 grid place-items-center bg-black/20">
                              <PlayCircle className="w-10 h-10 text-white" />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <img
                            src={item.url}
                            alt={`Slide ${item.index + 1}`}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                              setImgErrorIds((s) => ({ ...s, [item.id]: true }));
                            }}
                            loading="eager"
                          />
                          {imgErrorIds[item.id] && (
                            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/10 to-secondary/10">
                              <ImageIcon className="w-10 h-10 text-muted-foreground" />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Status icon */}
                    <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
                      {getStatusIcon(item.index)}
                    </div>

                    {/* Index + retry */}
                    <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium">
                      #{item.index + 1}
                      {job && (job.retry_count ?? 0) > 0 && (
                        <span className="ml-1 text-orange-500">↻{job.retry_count}</span>
                      )}
                    </div>

                    {/* Hover actions */}
                    <figcaption
                      className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    >
                      <div className="absolute bottom-2 left-2 text-white text-xs font-medium">
                        Slide {item.index + 1}
                      </div>
                      <a
                        href={item.url}
                        download
                        className="absolute bottom-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-primary/90 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        DL
                      </a>
                    </figcaption>
                  </figure>
                );
              })}
          </div>
        )}

        {/* Completion message */}
        {isComplete && (
          <div className="text-center text-sm text-muted-foreground pt-2">
            🎉 Toutes tes slides sont prêtes ! Télécharge-les ou retrouve-les dans ta bibliothèque.
          </div>
        )}
      </div>
    </Card>
  );
}
