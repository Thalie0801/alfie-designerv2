export type JobQueueStatus = "queued" | "running" | "completed" | "failed";
export type JobQueueType =
  | "api_generate_image"
  | "render_images"
  | "render_carousels"
  | "generate_texts"
  | "generate_video"
  | "copy"
  | "vision"
  | "upload"
  | "thumb";

export type JobKind = "image" | "carousel" | "video" | "text" | "unknown";

export interface JobQueueRow {
  id: string;
  user_id: string;
  order_id: string | null;
  type: JobQueueType;
  brand_id: string | null;
  status: JobQueueStatus;
  payload: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  retry_count?: number | null;
  max_retries?: number | null;
  attempts: number;
  max_attempts: number;
  idempotency_key?: string | null;
  is_archived: boolean;
  archived_at: string | null;
  job_version: number | null;
}

/** Déduit un kind lisible depuis type */
export function inferKindFromType(type: JobQueueType): JobKind {
  if (type.includes("image") || type === "render_images") return "image";
  if (type.includes("carousel") || type === "render_carousels") return "carousel";
  if (type.includes("video") || type === "generate_video") return "video";
  if (type === "copy" || type === "vision" || type === "generate_texts") return "text";
  return "unknown";
}

/** Normalise les statuts legacy vers les nouveaux */
export function normalizeStatus(status: string): JobQueueStatus {
  switch (status) {
    case "processing":
      return "running";
    case "done":
      return "completed";
    case "error":
      return "failed";
    default:
      return status as JobQueueStatus;
  }
}

/** Sélection standardisée (⚠️ sans `kind`) */
export const V_JOB_QUEUE_ACTIVE_SELECT = `
  id,
  user_id,
  order_id,
  type,
  brand_id,
  status,
  payload,
  result,
  error,
  created_at,
  updated_at,
  retry_count,
  max_retries,
  attempts,
  max_attempts,
  idempotency_key,
  is_archived,
  archived_at,
  job_version
`.trim();
