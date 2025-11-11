import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      .select(
        "id, type, kind, status, error, retry_count, attempts, max_retries, max_attempts, created_at, updated_at"
      )
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

    const counts = {
      queued: 0,
      retrying: 0,
      running: 0,
      completed: 0,
      failed: 0,
    } as Record<string, number>;
    let oldestQueuedAgeSec: number | null = null;
    let runningStuckCount = 0;
    const STUCK_THRESHOLD_SEC = 5 * 60; // 5 minutes

    const now = Date.now();

    const normaliseStatus = (status: string) => {
      switch (status) {
        case "processing":
          return "running";
        case "done":
          return "completed";
        case "error":
          return "failed";
        default:
          return status;
      }
    };

    for (const j of jobs ?? []) {
      const status = normaliseStatus(j.status ?? "queued");
      counts[status] = (counts[status] ?? 0) + 1;
      if (status === "queued" || status === "retrying") {
        const ageSec = Math.floor((now - new Date(j.created_at as string).getTime()) / 1000);
        if (oldestQueuedAgeSec === null || ageSec > oldestQueuedAgeSec) oldestQueuedAgeSec = ageSec;
      }
      if (status === "running") {
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

    const recent = (jobs ?? []).slice(0, 15).map((j) => {
      const status = normaliseStatus(j.status ?? "queued");
      return {
        id: j.id,
        type: j.type,
        kind: j.kind,
        status,
        error: j.error,
        retry: `${j.retry_count}/${j.max_retries ?? j.max_attempts ?? 3}`,
        attempts: j.attempts,
        max_attempts: j.max_attempts,
        updated_at: j.updated_at,
      };
    });

    const payload = {
      ok: true,
      now: nowIso,
      counts: {
        queued: counts.queued,
        running: counts.running,
        failed: counts.failed,
        completed: counts.completed,
        retrying: counts.retrying,
        completed_24h: completed24h ?? 0,
      },
      backlogSeconds: oldestQueuedAgeSec,
      stuck: { runningStuckCount, thresholdSec: STUCK_THRESHOLD_SEC },
      recent,
      scope: "user",
    };

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
