import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !INTERNAL_FN_SECRET) {
  throw new Error("Missing required environment variables for process-job-worker");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type JobType = "render_images" | "render_carousels";

type SupportedRatio = "1:1" | "4:5" | "9:16";

interface JobPayloadIntent {
  brandId: string;
  topic: string;
  ratio?: SupportedRatio;
  count?: number;
}

interface JobPayload {
  intent: JobPayloadIntent;
  [key: string]: unknown;
}

interface JobRow {
  id: string;
  type: JobType;
  order_id: string | null;
  user_id: string;
  brand_id: string | null;
  payload: JobPayload;
  retry_count: number;
  max_retries: number | null;
}

interface JobProcessResult {
  outputs: string[];
  totalRequested: number;
}

class JobExecutionError extends Error {
  constructor(
    message: string,
    public readonly partialOutputs: string[],
    public readonly totalRequested: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = "JobExecutionError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

function ratioToResolution(ratio?: SupportedRatio): string {
  switch (ratio) {
    case "1:1":
      return "1080x1080";
    case "9:16":
      return "1080x1920";
    case "4:5":
    default:
      return "1080x1350";
  }
}

async function claimNextJob(): Promise<JobRow | null> {
  const { data, error } = await supabase.rpc("claim_next_job");

  if (error) {
    console.error("[process-job-worker] Failed to claim job", error);
    throw error;
  }

  const claimed = Array.isArray(data) ? data[0] : undefined;
  if (!claimed) {
    return null;
  }

  const { data: jobRow, error: fetchError } = await supabase
    .from("job_queue")
    .select(
      "id, type, order_id, user_id, brand_id, payload, retry_count, max_retries",
    )
    .eq("id", claimed.id)
    .single();

  if (fetchError) {
    console.error("[process-job-worker] Failed to fetch claimed job", fetchError);
    throw fetchError;
  }

  const rawPayload = (jobRow as { payload: unknown }).payload;
  let parsedPayload: unknown = rawPayload;

  if (typeof rawPayload === "string") {
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch (parseError) {
      console.error("[process-job-worker] Failed to parse job payload", parseError);
      throw new Error("Invalid job payload JSON");
    }
  }

  if (!parsedPayload || typeof parsedPayload !== "object") {
    throw new Error("Claimed job payload is not an object");
  }

  const normalizedJob: JobRow = {
    id: (jobRow as { id: string }).id,
    type: (jobRow as { type: JobType }).type,
    order_id: (jobRow as { order_id: string | null }).order_id ?? null,
    user_id: (jobRow as { user_id: string }).user_id,
    brand_id: (jobRow as { brand_id: string | null }).brand_id ?? null,
    payload: parsedPayload as JobPayload,
    retry_count: (jobRow as { retry_count: number | null }).retry_count ?? 0,
    max_retries: (jobRow as { max_retries: number | null }).max_retries ?? null,
  };

  return normalizedJob;
}

async function callInternalFn<TResponse>(fnName: string, body: unknown): Promise<TResponse> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": INTERNAL_FN_SECRET || "",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Fn ${fnName} failed: ${resp.status} ${text}`);
  }

  return resp.json() as Promise<TResponse>;
}

async function insertMediaGeneration(params: {
  job: JobRow;
  brandId: string;
  outputUrl: string;
  intent: JobPayloadIntent;
  type: string;
  index?: number;
}) {
  const { job, brandId, outputUrl, intent, type, index } = params;
  const metadata = {
    jobType: job.type,
    resolution: ratioToResolution(intent.ratio),
    index,
  };

  const { error } = await supabase.from("media_generations").insert({
    job_id: job.id,
    order_id: job.order_id,
    user_id: job.user_id,
    brand_id: brandId,
    type,
    status: "completed",
    output_url: outputUrl,
    prompt: intent.topic,
    metadata,
  });

  if (error) {
    throw new Error(`Failed to persist media generation: ${error.message}`);
  }
}

async function handleRenderImages(job: JobRow): Promise<JobProcessResult> {
  const intent = job.payload?.intent;
  if (!intent) {
    throw new Error("Job payload missing intent");
  }
  if (!intent.brandId) {
    throw new Error("Job intent missing brandId");
  }
  if (!intent.topic) {
    throw new Error("Job intent missing topic");
  }

  const count = intent.count ?? 1;
  const resolution = ratioToResolution(intent.ratio);
  const outputs: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const response = await callInternalFn<Record<string, unknown>>("alfie-render-image", {
        userId: job.user_id,
        brand_id: intent.brandId,
        prompt: intent.topic,
        resolution,
      });

      const imageUrl = typeof response?.imageUrl === "string"
        ? response.imageUrl
        : typeof response?.url === "string"
          ? response.url
          : undefined;

      if (!imageUrl) {
        throw new Error("alfie-render-image did not return an image URL");
      }

      outputs.push(imageUrl);
      await insertMediaGeneration({
        job,
        brandId: intent.brandId,
        outputUrl: imageUrl,
        intent,
        type: "image",
        index: i,
      });
    } catch (err) {
      throw new JobExecutionError(
        err instanceof Error ? err.message : "Failed to render image",
        [...outputs],
        count,
        err,
      );
    }
  }

  return { outputs, totalRequested: count };
}

async function handleRenderCarouselsPhase1(job: JobRow): Promise<JobProcessResult> {
  const intent = job.payload?.intent;
  if (!intent) {
    throw new Error("Job payload missing intent");
  }
  if (!intent.brandId) {
    throw new Error("Job intent missing brandId");
  }
  if (!intent.topic) {
    throw new Error("Job intent missing topic");
  }

  const count = intent.count ?? 5;
  const resolution = ratioToResolution(intent.ratio);
  const outputs: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const response = await callInternalFn<Record<string, unknown>>("alfie-render-image", {
        userId: job.user_id,
        brand_id: intent.brandId,
        prompt: `${intent.topic} – slide ${i + 1}`,
        resolution,
      });

      const imageUrl = typeof response?.imageUrl === "string"
        ? response.imageUrl
        : typeof response?.url === "string"
          ? response.url
          : undefined;

      if (!imageUrl) {
        throw new Error("alfie-render-image did not return an image URL");
      }

      outputs.push(imageUrl);
      await insertMediaGeneration({
        job,
        brandId: intent.brandId,
        outputUrl: imageUrl,
        intent,
        type: "carousel_fallback_image",
        index: i,
      });
    } catch (err) {
      throw new JobExecutionError(
        err instanceof Error ? err.message : "Failed to render carousel fallback image",
        [...outputs],
        count,
        err,
      );
    }
  }

  return { outputs, totalRequested: count };
}

async function processJob(job: JobRow): Promise<JobProcessResult> {
  switch (job.type) {
    case "render_images":
      return await handleRenderImages(job);
    case "render_carousels":
      return await handleRenderCarouselsPhase1(job);
    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

async function updateOrderStatus(orderId: string, status: "completed" | "partial" | "failed") {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Failed to update order ${orderId} status: ${error.message}`);
  }
}

async function finalizeJobSuccess(job: JobRow, result: JobProcessResult) {
  const { error } = await supabase
    .from("job_queue")
    .update({
      status: "completed",
      result: { outputs: result.outputs },
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (error) {
    throw new Error(`Failed to mark job ${job.id} as completed: ${error.message}`);
  }
}

async function handleJobFailure(job: JobRow, err: Error, partial: string[], totalRequested: number) {
  const nextRetry = (job.retry_count ?? 0) + 1;
  const maxRetries = job.max_retries ?? 3;
  const shouldRetry = nextRetry <= maxRetries;
  const status = shouldRetry ? "queued" : "failed";

  const { error: updateError } = await supabase
    .from("job_queue")
    .update({
      status,
      retry_count: nextRetry,
      error: err.message,
      result: partial.length ? { outputs: partial } : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (updateError) {
    console.error("[process-job-worker] Failed to update job status after error", updateError);
  }

  if (job.order_id) {
    const orderStatus = partial.length > 0 && partial.length < totalRequested
      ? "partial"
      : partial.length === totalRequested && totalRequested > 0
        ? "completed"
        : "failed";

    try {
      await updateOrderStatus(job.order_id, orderStatus);
    } catch (orderErr) {
      console.error("[process-job-worker] Failed to update order status after job error", orderErr);
    }
  }

  if (!shouldRetry) {
    console.error(`[process-job-worker] Job ${job.id} failed permanently`, err);
  } else {
    console.warn(`[process-job-worker] Job ${job.id} failed (retrying ${nextRetry}/${maxRetries})`, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let job: JobRow | null = null;

  try {
    job = await claimNextJob();

    if (!job) {
      return new Response(JSON.stringify({ status: "empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-job-worker] Claimed job ${job.id} (${job.type})`);

    const result = await processJob(job);

    await finalizeJobSuccess(job, result);

    if (job.order_id) {
      await updateOrderStatus(job.order_id, "completed");
    }

    return new Response(
      JSON.stringify({ status: "ok", jobId: job.id, outputs: result.outputs }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (!job) {
      console.error("[process-job-worker] Fatal error before job claim", err);
      return new Response(JSON.stringify({ status: "error", message: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const partialOutputs = error instanceof JobExecutionError ? error.partialOutputs : [];
    const totalRequested = error instanceof JobExecutionError ? error.totalRequested : 0;

    await handleJobFailure(job, err, partialOutputs, totalRequested);

    return new Response(
      JSON.stringify({ status: "error", jobId: job.id, message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
