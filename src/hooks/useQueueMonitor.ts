import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseSafeClient";
import { useAuth } from "@/hooks/useAuth";

export type QueueMonitorCounts = {
  queued: number;
  running: number;
  done24h: number;
};

const STATUSES_TO_TRACK = ["queued", "running", "done", "completed"] as const;

type TrackedStatus = (typeof STATUSES_TO_TRACK)[number];

type JobRow = {
  status: TrackedStatus | string;
  created_at: string | null;
  updated_at: string | null;
};

function isTrackedStatus(status: string): status is TrackedStatus {
  return STATUSES_TO_TRACK.includes(status as TrackedStatus);
}

const INITIAL_COUNTS: QueueMonitorCounts = { queued: 0, running: 0, done24h: 0 };

export function useQueueMonitor(_brandId?: string) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<QueueMonitorCounts>(INITIAL_COUNTS);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCounts(INITIAL_COUNTS);
      return;
    }

    const since = Date.now() - 24 * 3600 * 1000;

    const { data, error } = await supabase
      .from("job_queue")
      .select("status, created_at, updated_at")
      .eq("user_id", user.id)
      .in("status", STATUSES_TO_TRACK);

    if (error || !data) {
      console.warn("useQueueMonitor: failed to fetch counts", error);
      return;
    }

    let queued = 0;
    let running = 0;
    let done24h = 0;

    for (const row of data as JobRow[]) {
      if (!row?.status || !isTrackedStatus(row.status)) continue;

      if (row.status === "queued") {
        queued += 1;
        continue;
      }

      if (row.status === "running") {
        running += 1;
        continue;
      }

      if (row.status === "done" || row.status === "completed") {
        const timestamp = new Date(row.updated_at ?? row.created_at ?? 0).getTime();
        if (!Number.isNaN(timestamp) && timestamp >= since) {
          done24h += 1;
        }
      }
    }

    setCounts({ queued, running, done24h });
  }, [user?.id]);

  useEffect(() => {
    refresh();

    if (!user?.id) return;

    const channel = supabase
      .channel(`queue-monitor-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_queue", filter: `user_id=eq.${user.id}` },
        () => {
          refresh();
        },
      )
      .subscribe();

    const intervalId = typeof window !== "undefined" ? window.setInterval(refresh, 5000) : null;

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [refresh, user?.id]);

  return { ...counts, refresh };
}
