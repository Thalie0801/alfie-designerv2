import { ok, fail, cors } from "../_shared/http.ts";
import { createClient, type PostgrestSingleResponse } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type JobRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  result?: Json | null;
  [key: string]: unknown;
};

type WebhookBody = {
  execution_id?: string;
  executionId?: string;
  status?: string;
  outputs?: unknown;
  output?: unknown;
  result?: unknown;
  error?: unknown;
  meta?: Record<string, unknown> | null;
};

const ALLOWED = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[mediaflow-webhook] Missing Supabase service credentials");
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const normalizeStatus = (input: string | null | undefined): "completed" | "failed" | "processing" => {
  const value = (input ?? "").toLowerCase();
  if (["succeeded", "success", "completed", "ready", "done"].includes(value)) return "completed";
  if (["failed", "fail", "error", "errored", "cancelled", "canceled"].includes(value)) return "failed";
  if (["processing", "running", "in_progress", "pending"].includes(value)) return "processing";
  return "processing";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractErrorMessage = (body: WebhookBody): string | null => {
  const { error, meta } = body;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (isRecord(error)) {
    const message =
      extractString(recordValue(error, "message")) ||
      extractString(recordValue(error, "error")) ||
      extractString(recordValue(error, "reason"));
    if (message && message.trim()) return message.trim();
  }
  if (isRecord(meta)) {
    const message =
      extractString(recordValue(meta, "error")) ||
      extractString(recordValue(meta, "error_message")) ||
      extractString(recordValue(meta, "reason"));
    if (message && message.trim()) return message.trim();
  }
  return null;
};

const toArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [value as T];
};

const extractString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const extractNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractUrl = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string" && value.startsWith("http")) return value;
  if (isRecord(value)) {
    const preferred =
      extractString(recordValue(value, "secure_url")) ||
      extractString(recordValue(value, "url")) ||
      extractString(recordValue(value, "href")) ||
      extractString(recordValue(value, "output_url")) ||
      extractString(recordValue(value, "outputUrl"));
    if (preferred) return preferred;
  }
  return null;
};

const extractPublicId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value)) {
    return (
      extractString(recordValue(value, "public_id")) ||
      extractString(recordValue(value, "publicId")) ||
      extractString(recordValue(value, "asset_id")) ||
      extractString(recordValue(value, "assetId")) ||
      null
    );
  }
  return null;
};

const recordValue = (record: Record<string, unknown> | null | undefined, key: string): unknown =>
  record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

const ensureSupabase = () => {
  if (!supabase) throw new Error("Supabase client not configured");
  return supabase;
};

const selectJob = async (column: string, value: string) => {
  try {
    const client = ensureSupabase();
    const { data, error }: PostgrestSingleResponse<JobRow> = await client
      .from<JobRow>("job_queue" as any)
      .select("*")
      .eq(column, value)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[mediaflow-webhook] selectJob error", { column, value, error });
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error("[mediaflow-webhook] selectJob exception", { column, value, err });
    return null;
  }
};

const findJob = async (executionId: string, meta: Record<string, unknown> | null | undefined) => {
  if (!executionId) return null;

  const directIds = [
    extractString(meta?.job_id),
    extractString(meta?.jobId),
    extractString(meta?.job_queue_id),
    extractString(meta?.jobQueueId),
    extractString(meta?.id)
  ].filter(Boolean) as string[];

  for (const candidate of directIds) {
    try {
      const client = ensureSupabase();
      const { data, error } = await client
        .from<JobRow>("job_queue" as any)
        .select("*")
        .eq("id", candidate)
        .maybeSingle();
      if (!error && data) return data;
    } catch (err) {
      console.error("[mediaflow-webhook] findJob by id failed", { candidate, err });
    }
  }

  const searchColumns = [
    "meta->>job_id",
    "meta->>jobId",
    "payload->>job_id",
    "payload->>jobId",
    "payload->>execution_id",
    "payload->>executionId",
    "result->>execution_id",
    "result->>job_id"
  ];

  for (const column of searchColumns) {
    const job = await selectJob(column, executionId);
    if (job) return job;
  }

  return null;
};

const normalizeAssetType = (raw: string | null | undefined): "image" | "carousel" | "carousel_slide" | "video" => {
  const value = (raw ?? "").toLowerCase();
  if (!value) return "image";
  if (value.includes("video")) return "video";
  if (value.includes("carousel_slide")) return "carousel_slide";
  if (value.includes("slide")) return "carousel_slide";
  if (value.includes("carousel")) return "carousel";
  return "image";
};

const safeTags = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const tags = value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0);
  return tags.length ? tags : null;
};

const upsertAsset = async (args: {
  job: JobRow;
  assetType: "image" | "carousel" | "carousel_slide" | "video";
  body: WebhookBody;
  outputEntry: Record<string, unknown> | null;
}) => {
  const { job, assetType, body, outputEntry } = args;
  const client = ensureSupabase();

  const payload = isRecord(job.payload) ? (job.payload as Record<string, unknown>) : {};
  const meta = isRecord(body.meta) ? (body.meta as Record<string, unknown>) : {};

  const userId =
    extractString(recordValue(meta, "user_id")) ||
    extractString(recordValue(meta, "userId")) ||
    extractString(recordValue(payload, "userId")) ||
    job.user_id;
  const brandId =
    extractString(recordValue(meta, "brand_id")) ||
    extractString(recordValue(meta, "brandId")) ||
    extractString(recordValue(payload, "brandId")) ||
    extractString(recordValue(payload, "brand_id"));
  const orderId =
    extractString(recordValue(meta, "order_id")) ||
    extractString(recordValue(meta, "orderId")) ||
    extractString(recordValue(payload, "orderId")) ||
    extractString(recordValue(payload, "order_id")) ||
    job.order_id;
  const orderItemId =
    extractString(recordValue(meta, "order_item_id")) ||
    extractString(recordValue(meta, "orderItemId")) ||
    extractString(recordValue(payload, "orderItemId")) ||
    extractString(recordValue(payload, "order_item_id")) ||
    null;
  const carouselId =
    extractString(recordValue(meta, "carousel_id")) ||
    extractString(recordValue(meta, "carouselId")) ||
    extractString(recordValue(payload, "carouselId")) ||
    null;
  const campaign = extractString(recordValue(meta, "campaign")) || extractString(recordValue(payload, "campaign")) || null;
  const slideIndex =
    extractNumber(recordValue(meta, "slide_index")) ?? extractNumber(recordValue(payload, "slideIndex"));
  const format =
    extractString(recordValue(meta, "format")) ||
    extractString(recordValue(payload, "format")) ||
    extractString(recordValue(outputEntry, "format")) ||
    extractString(recordValue(outputEntry, "resource_format"));

  const cloudinaryUrl =
    extractUrl(outputEntry) ||
    extractString(recordValue(meta, "url")) ||
    extractString(recordValue(meta, "secure_url")) ||
    extractUrl(body.outputs) ||
    extractUrl(body.output);
  const cloudinaryPublicId =
    extractPublicId(recordValue(outputEntry, "public_id")) ||
    extractPublicId(outputEntry) ||
    extractString(recordValue(meta, "public_id")) ||
    extractString(recordValue(meta, "publicId"));

  if (!cloudinaryUrl) {
    console.warn("[mediaflow-webhook] Missing cloudinary URL, skipping library insert", {
      jobId: job.id,
      assetType,
      outputs: body.outputs
    });
    return { assetId: null };
  }

  if (!userId) throw new Error("Unable to resolve asset user_id");

  const metadata = {
    ...(isRecord(recordValue(payload, "metadata"))
      ? (recordValue(payload, "metadata") as Record<string, unknown>)
      : {}),
    ...(isRecord(recordValue(payload, "meta"))
      ? (recordValue(payload, "meta") as Record<string, unknown>)
      : {}),
    ...(isRecord(recordValue(meta, "metadata"))
      ? (recordValue(meta, "metadata") as Record<string, unknown>)
      : {}),
    webhook_meta: meta,
    webhook_output: outputEntry,
    execution_id: body.execution_id ?? body.executionId ?? null,
    status: body.status ?? null
  } as Record<string, unknown>;

  const tags = safeTags(recordValue(meta, "tags")) || safeTags(recordValue(payload, "tags"));

  const record: Record<string, unknown> = {
    user_id: userId,
    brand_id: brandId ?? null,
    order_id: orderId ?? null,
    order_item_id: orderItemId ?? null,
    type: assetType === "carousel" ? "carousel_slide" : assetType,
    cloudinary_url: cloudinaryUrl,
    cloudinary_public_id: cloudinaryPublicId ?? null,
    campaign,
    carousel_id: carouselId,
    slide_index: slideIndex ?? null,
    format: format ?? null,
    metadata,
    tags: tags ?? null
  };

  const textJson =
    recordValue(meta, "text_json") ??
    recordValue(meta, "textJson") ??
    recordValue(payload, "text_json") ??
    recordValue(payload, "textJson");
  if (textJson !== undefined) record.text_json = textJson as Json;

  const title = extractString(recordValue(meta, "title")) || extractString(recordValue(payload, "title")) || null;
  if (title) record.title = title;

  const srcUrl =
    extractString(recordValue(meta, "src_url")) || extractString(recordValue(payload, "src_url")) || null;
  if (srcUrl) record.src_url = srcUrl;

  const expiresAt =
    extractString(recordValue(meta, "expires_at")) ||
    extractString(recordValue(payload, "expires_at")) ||
    null;
  if (expiresAt) record.expires_at = expiresAt;

  let assetId: string | null = null;

  if (cloudinaryPublicId) {
    const { data: existing, error: existingErr } = await client
      .from("library_assets")
      .select("id")
      .eq("cloudinary_public_id", cloudinaryPublicId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!existingErr && existing && existing.length) {
      assetId = existing[0].id;
      const { error: updateErr } = await client
        .from("library_assets")
        .update(record)
        .eq("id", assetId);
      if (updateErr) throw new Error(updateErr.message);
      return { assetId };
    }
  }

  const { data: inserted, error: insertErr } = await client
    .from("library_assets")
    .insert(record)
    .select("id")
    .maybeSingle();

  if (insertErr) throw new Error(insertErr.message);

  assetId = inserted?.id ?? null;
  return { assetId };
};

const updateJobStatus = async (jobId: string, status: "completed" | "failed" | "processing", body: WebhookBody, assetId: string | null, errorMessage?: string | null) => {
  const client = ensureSupabase();
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    result: {
      execution_id: body.execution_id ?? body.executionId ?? null,
      status: body.status ?? null,
      outputs: body.outputs ?? body.output ?? null,
      asset_id: assetId,
      meta: body.meta ?? null
    }
  };
  if (status === "failed") {
    payload.error = errorMessage ?? extractErrorMessage(body) ?? "unknown_error";
  } else {
    payload.error = null;
  }
  const { error } = await client.from("job_queue").update(payload).eq("id", jobId);
  if (error) throw new Error(error.message);
};

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED);
  if (req.method === "OPTIONS") return ok({ preflight: true }, headers);
  if (req.method !== "POST") return fail(405, "Method not allowed", null, headers);

  try {
    if (!supabase) throw new Error("Supabase client unavailable");

    const body = (await req.json()) as WebhookBody;
    const executionId = body.execution_id ?? body.executionId;
    if (!executionId) return fail(400, "Missing execution_id", null, headers);

    const job = await findJob(executionId, body.meta ?? null);
    if (!job) {
      console.warn("[mediaflow-webhook] Job not found", { executionId });
      return ok({ received: true, execution_id: executionId, job: null }, headers);
    }

    const normalized = normalizeStatus(body.status ?? null);

    if (normalized === "failed") {
      await updateJobStatus(job.id, "failed", body, null, extractErrorMessage(body));
      return ok({ received: true, execution_id: executionId, status: normalized, job_id: job.id }, headers);
    }

    const outputsArray = toArray<Record<string, unknown>>(body.outputs ?? body.output ?? body.result ?? []);
    const primaryOutput =
      outputsArray.find((o) => extractUrl(o)) ?? (isRecord(body.result) ? (body.result as Record<string, unknown>) : null);

    const bodyMeta = isRecord(body.meta) ? (body.meta as Record<string, unknown>) : null;
    const jobMeta = isRecord(job.meta) ? (job.meta as Record<string, unknown>) : null;
    const jobPayload = isRecord(job.payload) ? (job.payload as Record<string, unknown>) : null;
    const primaryOutputRecord = isRecord(primaryOutput) ? (primaryOutput as Record<string, unknown>) : null;

    const assetTypeRaw =
      extractString(recordValue(bodyMeta, "asset_type")) ||
      extractString(recordValue(bodyMeta, "type")) ||
      extractString(recordValue(jobMeta, "asset_type")) ||
      extractString(recordValue(jobMeta, "type")) ||
      extractString(recordValue(jobPayload, "assetType")) ||
      extractString(recordValue(jobPayload, "type")) ||
      extractString(recordValue(primaryOutputRecord, "resource_type")) ||
      extractString(recordValue(primaryOutputRecord, "type"));

    const assetType = normalizeAssetType(assetTypeRaw);

    const { assetId } = await upsertAsset({ job, assetType, body, outputEntry: primaryOutput });

    await updateJobStatus(job.id, "completed", body, assetId);

    return ok({ received: true, execution_id: executionId, status: normalized, job_id: job.id, asset_id: assetId }, headers);
  } catch (err) {
    console.error("[mediaflow-webhook] Handler error", err);
    return fail(500, "webhook failed", err instanceof Error ? err.message : String(err), headers);
  }
});
