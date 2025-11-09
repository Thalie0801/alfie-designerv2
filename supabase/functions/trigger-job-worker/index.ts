import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, fail, ok } from "../_shared/http.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../_shared/env.ts";

const ALLOWED = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

let RUNNING = false;

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED);
  if (req.method === "OPTIONS") return ok({ preflight: true }, headers);

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("health") === "1") {
    return ok({ health: "up" }, headers);
  }

  if (req.method !== "POST") {
    return fail(405, "Method not allowed", null, headers);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return fail(500, "Missing environment configuration", null, headers);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return fail(401, "Missing authorization", null, headers);
  }

  if (RUNNING) {
    return fail(409, "Un traitement est déjà en cours", null, headers);
  }

  RUNNING = true;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return fail(401, "Unauthorized", authError?.message, headers);
    }

    console.log(`[trigger-job-worker] Manual trigger by user ${user.id}`);

    const queuedBefore = await countPendingJobs(supabase);
    console.log(`[trigger-job-worker] queuedBefore=${queuedBefore}`);

    const processedNow = await runPendingJobs(supabase);
    const queuedAfter = await countPendingJobs(supabase);

    const processed =
      typeof processedNow === "number"
        ? processedNow
        : Math.max(queuedBefore - queuedAfter, 0);

    if (processed === 0 && queuedBefore > 0) {
      console.warn(
        `[trigger-job-worker] processed=0 with queuedBefore=${queuedBefore}, queuedAfter=${queuedAfter}`,
      );
    }

    return ok({ processed, queuedBefore, queuedAfter }, headers);
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return fail(500, "Trigger worker failed", details, headers);
  } finally {
    RUNNING = false;
  }
});

async function countPendingJobs(client: SupabaseClient) {
  const { count, error } = await client
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  if (error) {
    throw new Error(`countPendingJobs failed: ${error.message}`);
  }

  return count ?? 0;
}

async function runPendingJobs(client: SupabaseClient) {
  const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(55_000)
    : undefined;

  const { data, error } = await client.functions.invoke("alfie-job-worker", {
    body: { trigger: "manual" },
    signal,
  });

  if (error) {
    console.error("[trigger-job-worker] Worker failed", error);
    throw new Error(error.message || "Worker invocation failed");
  }

  return extractProcessed(data);
}

function extractProcessed(input: unknown): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "number") return input;
  if (typeof input === "object") {
    const maybeRecord = input as Record<string, unknown>;
    if (typeof maybeRecord.processed === "number") return maybeRecord.processed;
    if ("data" in maybeRecord) {
      return extractProcessed(maybeRecord.data);
    }
  }
  return undefined;
}
