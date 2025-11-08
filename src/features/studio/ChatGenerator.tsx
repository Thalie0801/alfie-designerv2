// src/features/studio/ChatGenerator.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Upload, Wand2, Download, X, Sparkles, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { uploadToChatBucket } from "@/lib/chatUploads";
import { useLocation, useNavigate } from "react-router-dom";
import { useBrandKit } from "@/hooks/useBrandKit";
import { toast } from "sonner";
import { useQueueMonitor } from "@/hooks/useQueueMonitor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildJobIdempotencyKey } from "@/lib/jobs/idempotency";

type GeneratedAsset = { url: string; type: "image" | "video" };
type AspectRatio = "1:1" | "9:16" | "16:9";
type ContentType = "image" | "video";

type UploadedSource = { type: "image" | "video"; url: string; name: string };

type JobEntry = {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  order_id: string | null;
  created_at: string;
  updated_at: string;
  error?: string | null;
  error_message?: string | null;
  payload?: unknown;
  user_id: string;
  archived_at: string | null;
  is_archived: boolean;
  job_version: number | null;
  retry_count?: number | null;
  max_retries?: number | null;
  locked_by?: string | null;
  started_at?: string | null;
  attempts?: number | null;
  idempotency_key?: string | null;
};

type MediaEntry = {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  order_id?: string | null;
  output_url: string | null;
  thumbnail_url?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
};

const PROMPT_EXAMPLES = {
  image: [
    "Une plage tropicale au coucher du soleil avec des palmiers",
    "Un café parisien avec des tables en terrasse, style aquarelle",
    "Un paysage de montagne enneigé avec un lac gelé",
    "Une rue animée de Tokyo la nuit avec des néons",
  ],
  video: [
    "Une cascade qui coule dans une forêt tropicale",
    "Des nuages qui défilent rapidement au-dessus d'une ville",
    "Un feu de camp qui crépite la nuit sous les étoiles",
    "Une route qui traverse un désert au lever du soleil",
  ],
};

const MEDIA_URL_KEYS = ["imageUrl", "image_url", "url", "outputUrl", "output_url", "videoUrl", "video_url"] as const;

const ASPECT_TO_TW: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

const CURRENT_JOB_VERSION = 2;
const UNKNOWN_REFRESH_ERROR = "Erreur inconnue pendant le rafraîchissement";

function resolveRefreshErrorMessage(error: unknown): string {
  if (!error) return UNKNOWN_REFRESH_ERROR;
  if (error instanceof Error && error.message?.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;

  if (typeof error === "object" && error) {
    const e = error as Record<string, unknown>;
    const status = typeof e.status === "number" ? e.status : typeof e.code === "number" ? e.code : undefined;

    const candidates = [e.message, e.error_description, e.error, e.details, e.hint];
    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) {
        return status ? `${v} (code ${status})` : v;
      }
    }
  }
  return UNKNOWN_REFRESH_ERROR;
}

function extractMediaUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  for (const key of MEDIA_URL_KEYS) {
    const v = obj[key as keyof typeof obj];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const v of Object.values(obj)) {
    if (typeof v === "object" && v !== null) {
      const nested = extractMediaUrl(v);
      if (nested) return nested;
    }
  }
  return null;
}

export function ChatGenerator() {
  const { activeBrandId } = useBrandKit();
  const location = useLocation();
  const navigate = useNavigate();

  const orderId = useMemo(() => new URLSearchParams(location.search).get("order"), [location.search]) || null;

  const orderLabel = useMemo(() => (orderId ? `Commande ${orderId}` : "Toutes les commandes"), [orderId]);

  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [uploadedSource, setUploadedSource] = useState<UploadedSource | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [assets, setAssets] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);

  const isMountedRef = useRef(true);
  const refetchSeqRef = useRef(0);
  const refetchAbortRef = useRef<AbortController | null>(null);

  const { toast: showToast } = useToast();

  // Monitor queue status (affichage ailleurs si besoin)
  useQueueMonitor(true);

  // Jobs bloqués (> 10mn en queued)
  const stuckJobs = useMemo(
    () =>
      jobs.filter((j) => {
        if (j.status !== "queued") return false;
        const updatedAt = new Date(j.updated_at).getTime();
        const minutes = (Date.now() - updatedAt) / 60000;
        return minutes > 10;
      }),
    [jobs],
  );

  const jobBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "queued":
        return "secondary";
      case "running":
        return "default";
      case "failed":
        return "destructive";
      case "completed":
      default:
        return "outline";
    }
  };

  const mediaBadgeVariant = jobBadgeVariant;

  const formatDate = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const refetchAll = useCallback(async () => {
    const requestId = (refetchSeqRef.current += 1);

    // Annule un refresh précédent encore en vol
    if (refetchAbortRef.current) {
      try {
        refetchAbortRef.current.abort();
      } catch {}
    }
    const aborter = new AbortController();
    refetchAbortRef.current = aborter;

    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    const dedupeById = <T extends { id?: string | number }>(items: readonly T[] | null | undefined) => {
      if (!items) return [] as T[];
      const seen = new Set<string>();
      const result: T[] = [];
      for (const item of items) {
        if (!item) continue;
        const value = (item as { id?: string | number }).id;
        const key = typeof value === "string" || typeof value === "number" ? String(value) : Math.random().toString(36);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
      return result;
    };

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!currentUser) throw new Error("Non authentifié");

      let jobsQuery = supabase
        .from("job_queue")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      let assetsQuery = supabase
        .from("media_generations")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (orderId) {
        jobsQuery = jobsQuery.eq("order_id", orderId);
        assetsQuery = assetsQuery.eq("order_id", orderId);
      }

      const [jobsResponse, assetsResponse] = await Promise.all([jobsQuery, assetsQuery]);

      if (jobsResponse.error) throw jobsResponse.error;
      if (assetsResponse.error) throw assetsResponse.error;

      const jobsData = (jobsResponse.data as JobEntry[] | null | undefined) ?? [];
      const assetsData = (assetsResponse.data as MediaEntry[] | null | undefined) ?? [];

      if (isMountedRef.current && refetchSeqRef.current === requestId) {
        setJobs(dedupeById(jobsData));
        setAssets(dedupeById(assetsData));
        setError(null);
      }
    } catch (err) {
      console.error("[Studio] refetchAll error:", err);
      const msg = resolveRefreshErrorMessage(err);
      if (isMountedRef.current && refetchSeqRef.current === requestId) {
        setJobs([]);
        setAssets([]);
        setError(msg);
      }
    } finally {
      if (isMountedRef.current && refetchSeqRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refetchAbortRef.current) {
        try {
          refetchAbortRef.current.abort();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await refetchAll();

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (authError) {
        console.error("[Studio] auth error after refetch:", authError);
        setError((prev) => prev ?? authError.message);
        return;
      }
      if (!currentUser) return;

      channel = supabase
        .channel("studio-stream")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "job_queue",
            filter: `user_id=eq.${currentUser.id}`,
          },
          () => {
            // Soft debounce: on ne relance pas si un refresh est déjà en vol
            if (!loading) refetchAll();
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refetchAll, loading]);

  const requeueJob = useCallback(
    async (job: JobEntry) => {
      try {
        // 1) parser payload si string
        let payload: unknown = job.payload ?? null;
        if (typeof payload === "string" && payload.trim()) {
          try {
            payload = JSON.parse(payload);
          } catch {
            throw new Error("Impossible de relancer le job: payload invalide");
          }
        }
        if (payload == null) {
          throw new Error("Impossible de relancer ce job sans payload");
        }

        // 2) clé d’idempotence (pour le prochain traitement réel)
        const idempotencyKey = buildJobIdempotencyKey({
          orderId: job.order_id ?? null,
          userId: job.user_id,
          type: job.type,
          payload,
        });

        // 3) on remet le **même job** en queued (on n’insère pas un doublon)
        const { data: updated, error: updateError } = await supabase
          .from("job_queue")
          .update({
            status: "queued",
            error: null,
            error_message: null,
            locked_by: null,
            started_at: null,
            attempts: 0,
            idempotency_key: idempotencyKey,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("user_id", job.user_id)
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;
        if (!updated) throw new Error("Impossible de relancer ce job (introuvable)");

        showToast({
          title: "Job relancé",
          description: "Le job a été renvoyé en file d'attente",
        });

        await refetchAll();
      } catch (err) {
        console.error("[Studio] requeueJob error:", err);
        showToast({
          title: "Échec du renvoi",
          description: err instanceof Error ? err.message : "Erreur inconnue lors du renvoi du job",
          variant: "destructive",
        });
      }
    },
    [refetchAll, showToast],
  );

  const cleanupLegacyJobs = useCallback(async () => {
    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !currentUser) return;

    await supabase
      .from("job_queue")
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq("user_id", currentUser.id)
      .eq("job_version", 1);
    await refetchAll();
  }, [refetchAll]);

  const { toast: toastShadcn } = useToast();

  const handleDownload = useCallback(async () => {
    if (!generatedAsset?.url) return;
    try {
      const res = await fetch(generatedAsset.url);
      if (!res.ok) throw new Error("Téléchargement impossible");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = generatedAsset.type === "image" ? "alfie-image.png" : "alfie-video.mp4";
      a.click();
      URL.revokeObjectURL(a.href);

      toastShadcn({
        title: "Téléchargement réussi",
        description: `${generatedAsset.type === "image" ? "Image" : "Vidéo"} sauvegardée`,
      });
    } catch (err: any) {
      console.error("Download error:", err);
      toastShadcn({
        title: "Erreur de téléchargement",
        description: err.message,
        variant: "destructive",
      });
    }
  }, [generatedAsset, toastShadcn]);

  const handleExampleClick = (example: string) => setPrompt(example);

  // Déclenchement manuel du worker + watchdog
  const handleTriggerWorker = useCallback(async () => {
    setIsTriggeringWorker(true);
    try {
      const { data, error } = await supabase.functions.invoke("trigger-job-worker", {});
      if (error) throw error;

      const summary = (data || {}) as {
        jobsQueued?: number;
        watchdog?: { reset_count?: number; failed_count?: number };
      };
      const queued = summary.jobsQueued ?? 0;
      const resetCount = summary.watchdog?.reset_count ?? 0;
      const failedCount = summary.watchdog?.failed_count ?? 0;
      const extra = summary.watchdog ? ` — ${resetCount} débloqué(s), ${failedCount} passé(s) en échec` : "";

      toast.success(`Worker déclenché: ${queued} job(s) à traiter${extra}`);

      await refetchAll();
    } catch (err) {
      console.error("[Studio] trigger worker error:", err);
      toast.error(`Échec du déclenchement: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    } finally {
      setIsTriggeringWorker(false);
    }
  }, [refetchAll]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Alfie Studio</h1>
          </div>
          <p className="text-muted-foreground text-lg">Créez des images et vidéos avec l&apos;IA</p>
        </div>

        {/* … garde le reste de ton UI ici (forms, file upload, liste jobs/assets, etc.) … */}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleTriggerWorker} disabled={isTriggeringWorker} variant="secondary">
            {isTriggeringWorker ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Déclenchement…
              </>
            ) : (
              "Forcer le traitement"
            )}
          </Button>
          {stuckJobs.length > 0 && (
            <Alert variant="destructive" className="ml-2">
              <AlertDescription>{stuckJobs.length} job(s) bloqué(s) (&gt; 10 min).</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
