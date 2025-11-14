import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  INTERNAL_FN_SECRET,
  RENDER_BACKEND_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "../_shared/env.ts";

type JobStep = "copy" | "vision" | "render" | "upload";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface JobRecord {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  order_id: string | null;
  user_id: string;
  brand_id: string | null;
  created_at?: string;
  orders?: {
    id: string;
    brand_id: string | null;
    user_id: string;
    metadata: Record<string, unknown> | null;
    brief_json: Record<string, unknown> | null;
    status: string;
  } | null;
}

interface ProcessResult {
  processed: number;
  total: number;
  skipped: number;
  errors: number;
}

const NEXT_STEP: Record<JobStep, JobStep | null> = {
  copy: "vision",
  vision: "render",
  render: "upload",
  upload: null,
};

const DEFAULT_BACKEND_URL = "https://alfie-designer.onrender.com";

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

function ensureEnv(): asserts supabase is NonNullable<typeof supabase> {
  if (!supabase) {
    throw new Error("Supabase credentials are not configured");
  }
}

function backendUrl(): string {
  const base = (RENDER_BACKEND_URL || DEFAULT_BACKEND_URL).trim();
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function toJson(value: unknown): JsonValue {
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJson(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const output: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(obj)) {
      const serialised = toJson(val);
      if (serialised !== undefined) {
        output[key] = serialised;
      }
    }
    return output;
  }
  return String(value);
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (error) {
      console.warn("[process-jobs] Failed to parse payload string", error);
      return {};
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function extractMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const raw = payload.metadata;
  if (raw && typeof raw === "object") {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function extractHistory(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = payload.history;
  if (Array.isArray(raw)) {
    return raw.map((entry) => (typeof entry === "object" && entry ? { ...entry } : {}));
  }
  return [];
}

function normaliseResult(result: unknown): JsonValue {
  if (result === undefined) return null;
  if (typeof result === "string" || typeof result === "number" || typeof result === "boolean" || result === null) {
    return result;
  }
  try {
    return toJson(result);
  } catch (error) {
    console.warn("[process-jobs] Failed to normalise result", error);
    return { value: String(result) };
  }
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function callBackend(step: JobStep, payload: Record<string, unknown>) {
  const endpointMap: Record<JobStep, string> = {
    copy: "/api/generate-copy",
    vision: "/api/generate-vision",
    render: "/api/render-image",
    upload: "/api/upload-cloudinary",
  };

  const url = `${backendUrl()}${endpointMap[step]}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = typeof (data as { error?: unknown } | null)?.error === "string"
      ? (data as { error: string }).error
      : response.statusText || `Step ${step} failed`;
    throw new Error(`${message} (${response.status})`);
  }

  return data;
}

async function enqueueNextJob(job: JobRecord, nextStep: JobStep, payload: Record<string, unknown>, metadata: Record<string, unknown>) {
  ensureEnv();

  const nextPayload = {
    ...payload,
    metadata,
  };

  const brandId = job.brand_id
    ?? metadata.brandId
    ?? job.orders?.brand_id
    ?? (typeof payload.brandId === "string" ? payload.brandId : null);

  const { error } = await supabase
    .from("job_queue")
    .insert({
      user_id: job.user_id,
      brand_id: brandId,
      order_id: job.order_id,
      type: nextStep,
      status: "pending",
      payload: toJson(nextPayload),
    });

  if (error) {
    throw new Error(`Failed to enqueue ${nextStep} job: ${error.message}`);
  }
}

async function completeOrder(job: JobRecord, metadata: Record<string, unknown>, outputUrl: string) {
  ensureEnv();

  if (!job.order_id) return;

  const orderMeta = job.orders?.metadata && typeof job.orders.metadata === "object" && job.orders.metadata !== null
    ? { ...(job.orders.metadata as Record<string, unknown>) }
    : {};

  const updatedMetadata = {
    ...orderMeta,
    ...metadata,
    lastJobId: job.id,
    completedAt: new Date().toISOString(),
    outputUrl,
    pipeline: "generate-image",
  };

  const { error } = await supabase
    .from("orders")
    .update({ status: "completed", metadata: toJson(updatedMetadata) })
    .eq("id", job.order_id);

  if (error) {
    console.warn(`[process-jobs] Failed to update order ${job.order_id}`, error);
  }
}

async function insertMediaGeneration(job: JobRecord, payload: Record<string, unknown>, metadata: Record<string, unknown>, result: Record<string, unknown>) {
  ensureEnv();

  const outputUrl = pickFirstString(result, ["outputUrl", "output_url", "url"])
    ?? pickFirstString(metadata, ["outputUrl", "output_url"])
    ?? pickFirstString(payload, ["outputUrl", "output_url"]);

  if (!outputUrl) {
    throw new Error("Upload step did not return an output URL");
  }

  const thumbnailUrl = pickFirstString(result, ["thumbnailUrl", "thumbnail_url", "thumbUrl", "thumb_url"])
    ?? pickFirstString(metadata, ["thumbnailUrl", "thumbnail_url"]);

  const prompt = typeof payload.prompt === "string"
    ? payload.prompt
    : typeof metadata.prompt === "string"
      ? metadata.prompt
      : null;

  const brandId = job.brand_id
    ?? metadata.brandId
    ?? job.orders?.brand_id;

  if (!brandId || typeof brandId !== "string") {
    throw new Error("Cannot determine brand_id for media generation");
  }

  const mediaMetadata = {
    ...metadata,
    uploadResult: result,
  };

  const insertPayload = {
    user_id: job.user_id,
    brand_id: brandId,
    order_id: job.order_id,
    type: "image",
    status: "completed",
    output_url: outputUrl,
    thumbnail_url: thumbnailUrl,
    prompt,
    metadata: toJson(mediaMetadata),
  };

  const { error } = await supabase.from("media_generations").insert(insertPayload);
  if (error) {
    throw new Error(`Failed to persist media generation: ${error.message}`);
  }

  await completeOrder(job, mediaMetadata, outputUrl);
}

async function markJobStatus(jobId: string, status: string, patch: Record<string, unknown>) {
  ensureEnv();

  const { error } = await supabase
    .from("job_queue")
    .update({ status, ...patch })
    .eq("id", jobId);

  if (error) {
    console.error(`[process-jobs] Failed to update job ${jobId} status to ${status}`, error);
  }
}

type JobOutcome = "completed" | "skipped" | "failed";

async function processJob(job: JobRecord): Promise<JobOutcome> {
  ensureEnv();

  const step = job.type as JobStep;
  if (!Object.prototype.hasOwnProperty.call(NEXT_STEP, step)) {
    console.warn(`[process-jobs] Unsupported job type ${job.type}, skipping`);
    return "skipped";
  }

  const payload = parsePayload(job.payload);
  const metadata = extractMetadata(payload);
  const history = extractHistory(payload);

  const now = new Date().toISOString();
  history.push({ step, status: "processing", at: now });

  const processingPayload = {
    ...payload,
    metadata,
    history,
    lastStartedAt: now,
  };

  const { data: claimed, error: claimError } = await supabase
    .from("job_queue")
    .update({ status: "processing", payload: toJson(processingPayload) })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error(`[process-jobs] Failed to claim job ${job.id}`, claimError);
    return "skipped";
  }

  if (!claimed) {
    // Another worker processed it.
    return "skipped";
  }

  try {
    const requestPayload: Record<string, unknown> = {
      jobId: job.id,
      orderId: job.order_id,
      userId: job.user_id,
      brandId: job.brand_id ?? metadata.brandId ?? job.orders?.brand_id,
      step,
      ...payload,
      metadata,
      history,
    };

    const rawResult = await callBackend(step, requestPayload);
    const result = (typeof rawResult === "object" && rawResult !== null)
      ? (rawResult as Record<string, unknown>)
      : { value: rawResult };

    const completedAt = new Date().toISOString();
    history.push({ step, status: "completed", at: completedAt });

    metadata[`${step}Result`] = result;

    const completedPayload = {
      ...payload,
      metadata,
      history,
      lastCompletedAt: completedAt,
    };

    await markJobStatus(job.id, "completed", {
      result: normaliseResult(result),
      payload: toJson(completedPayload),
    });

    if (step === "upload") {
      await insertMediaGeneration(job, payload, metadata, result);
    } else {
      const next = NEXT_STEP[step];
      if (next) {
        await enqueueNextJob(job, next, completedPayload, metadata);
      }
    }

    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[process-jobs] Job ${job.id} failed at step ${step}:`, error);

    history.push({ step, status: "failed", at: new Date().toISOString(), error: message });

    const failedPayload = {
      ...payload,
      metadata,
      history,
    };

    await markJobStatus(job.id, "failed", {
      error: message,
      payload: toJson(failedPayload),
    });

    if (job.order_id) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", job.order_id);
    }

    return "failed";
  }
}

async function fetchPendingJobs(): Promise<JobRecord[]> {
  ensureEnv();

  const { data, error } = await supabase
    .from("job_queue")
    .select(`
      id,
      type,
      status,
      payload,
      order_id,
      user_id,
      brand_id,
      created_at,
      orders (
        id,
        brand_id,
        user_id,
        metadata,
        brief_json,
        status
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return data as JobRecord[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (INTERNAL_FN_SECRET) {
    const headerSecret = req.headers.get("x-internal-secret") ?? req.headers.get("X-Internal-Secret");
    if (headerSecret !== INTERNAL_FN_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  try {
    ensureEnv();

    const jobs = await fetchPendingJobs();
    const stats: ProcessResult = {
      processed: 0,
      total: jobs.length,
      skipped: 0,
      errors: 0,
    };

    for (const job of jobs) {
      const outcome = await processJob(job);
      if (outcome === "completed") {
        stats.processed += 1;
      } else if (outcome === "failed") {
        stats.errors += 1;
      } else {
        stats.skipped += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[process-jobs] Worker error", error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message ?? "unexpected_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
