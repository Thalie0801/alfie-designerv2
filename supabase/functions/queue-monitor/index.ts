import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.warn("[queue-monitor] Unauthorized access", { userErr });
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const nowIso = new Date().toISOString();
    console.log("[queue-monitor] Start", { userId, nowIso });

    // Fetch recent jobs for the user
    const { data: jobs, error: jobsErr } = await supabase
      .from("job_queue")
      .select("id, type, status, error, retry_count, max_retries, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (jobsErr) {
      console.error("[queue-monitor] jobsErr", jobsErr);
      return new Response(JSON.stringify({ ok: false, error: jobsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const counts = { queued: 0, running: 0, completed: 0, failed: 0 } as Record<string, number>;
    let oldestQueuedAgeSec: number | null = null;
    let runningStuckCount = 0;
    const STUCK_THRESHOLD_SEC = 5 * 60; // 5 minutes

    const now = Date.now();

    for (const j of jobs ?? []) {
      counts[j.status] = (counts[j.status] ?? 0) + 1;
      if (j.status === "queued") {
        const ageSec = Math.floor((now - new Date(j.created_at as string).getTime()) / 1000);
        if (oldestQueuedAgeSec === null || ageSec > oldestQueuedAgeSec) oldestQueuedAgeSec = ageSec;
      }
      if (j.status === "running") {
        const ageSec = Math.floor((now - new Date(j.updated_at as string).getTime()) / 1000);
        if (ageSec > STUCK_THRESHOLD_SEC) runningStuckCount += 1;
      }
    }

    // Also compute last 24h completed count (for context)
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: completed24h } = await supabase
      .from("job_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("updated_at", sinceIso);

    const recent = (jobs ?? []).slice(0, 15).map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      error: j.error,
      retry: `${j.retry_count}/${j.max_retries}`,
      updated_at: j.updated_at,
    }));

    type QueueMonitorPayload = {
      ok: boolean;
      now: string;
      counts: typeof counts & { completed_24h: number };
      backlogSeconds: number | null;
      stuck: { runningStuckCount: number; thresholdSec: number };
      recent: typeof recent;
      scope: "user";
      workerKick?: { attempted: boolean; triggerPayload?: Record<string, unknown>; error?: string };
    };

    const payload: QueueMonitorPayload = {
      ok: true,
      now: nowIso,
      counts: { ...counts, completed_24h: completed24h ?? 0 },
      backlogSeconds: oldestQueuedAgeSec,
      stuck: { runningStuckCount, thresholdSec: STUCK_THRESHOLD_SEC },
      recent,
      scope: "user",
    };

    // Auto-kick the worker when we detect a backlog with nothing running
    if (counts.queued > 0 && counts.running === 0) {
      console.warn("[queue-monitor] Detected queued jobs with no worker running – triggering worker");

      const triggerPayload = {
        reason: "queue-monitor-auto-kick",
        oldestQueuedAgeSec: oldestQueuedAgeSec ?? null,
        queued: counts.queued,
      };

      try {
        await supabase.functions.invoke("alfie-job-worker", { body: triggerPayload });
        payload.workerKick = { attempted: true, triggerPayload };
      } catch (kickError) {
        console.error("[queue-monitor] Failed to trigger alfie-job-worker", kickError);
        payload.workerKick = { attempted: true, error: (kickError as Error).message };
      }
    }

    console.log("[queue-monitor] Done", payload.counts);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[queue-monitor] Fatal", e);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
