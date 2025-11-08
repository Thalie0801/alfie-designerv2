// src/features/studio/ChatGenerator.tsx
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useQueueMonitor } from "@/hooks/useQueueMonitor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sanitizeOrderId } from "@/lib/jobs/requeue";

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

export function ChatGenerator() {
  const location = useLocation();

  const orderId = useMemo(() => {
    const rawOrderId = new URLSearchParams(location.search).get("order");
    return sanitizeOrderId(rawOrderId);
  }, [location.search]);

  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [_assets, setAssets] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);

  const isMountedRef = useRef(true);
  const refetchSeqRef = useRef(0);
  const refetchAbortRef = useRef<AbortController | null>(null);

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
        // DO NOT clear jobs/assets on error - keep previous state
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
