import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { cors, fail, ok } from "../_shared/http.ts";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from "../_shared/env.ts";

const ALLOWED_ORIGINS = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED_ORIGINS);

  if (req.method === "OPTIONS") {
    return ok({ preflight: true }, headers);
  }

  if (req.method !== "POST") {
    return fail(405, "Method not allowed", null, headers);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return fail(500, "Missing Supabase configuration", null, headers);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return fail(401, "Missing authorization", null, headers);
  }

  try {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return fail(401, "Unauthorized", authError?.message, headers);
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const queuedBefore = await countPendingJobs(serviceClient);

    const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(55_000)
      : undefined;

    const { data: workerData, error: workerError } = await serviceClient.functions.invoke(
      "process-job-worker",
      {
        body: { source: "force-process", requestedBy: user.id },
        signal,
      },
    );

    if (workerError) {
      return fail(500, "Worker invocation failed", workerError.message, headers);
    }

    const queuedAfter = await countPendingJobs(serviceClient);
    const processed = Math.max(queuedBefore - queuedAfter, 0);

    return ok(
      {
        processed,
        queuedBefore,
        queuedAfter,
        worker: workerData ?? null,
      },
      headers,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, "force-process failed", message, headers);
  }
});

async function countPendingJobs(client: SupabaseClient) {
  const { count, error } = await client
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "queued"]);

  if (error) {
    throw new Error(`countPendingJobs failed: ${error.message}`);
  }

  return count ?? 0;
}
// supabase/functions/force-process/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    // Requiert un user connecté côté client (Bearer user JWT)
    const bearer = req.headers.get("Authorization");
    if (!bearer) return new Response("Unauthorized", { status: 401 });

    // (Optionnel) Ajouter une vérification d’admin:
    // - soit via un claim custom dans le JWT
    // - soit via une requête RLS-safe sur profile (hors scope ici)

    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) {
      return new Response("Missing SUPABASE_URL or SERVICE_ROLE", { status: 500 });
    }

    const res = await fetch(`${url}/functions/v1/process-job-worker?force=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${service}` }
    });

    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (e) {
    return new Response(`force-process error: ${e}`, { status: 500 });
  }
});
