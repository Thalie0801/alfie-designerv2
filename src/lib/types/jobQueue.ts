export type JobQueueStatus = 'queued' | 'running' | 'completed' | 'failed';

export type JobQueueType =
  | 'api_generate_image'
  | 'render_images'
  | 'render_carousels'
  | 'generate_texts'
  | 'generate_video'
  | 'copy'
  | 'vision'
  | 'upload'
  | 'thumb';

export type JobKind = 'image' | 'carousel' | 'video' | 'text' | 'unknown';

export interface JobQueue {
  id: string;
  order_id: string | null;
  user_id: string;
  brand_id: string | null;
  type: JobQueueType;
  kind: JobKind | null;
  status: JobQueueStatus;
  payload: Record<string, unknown>;
  error: string | null;
  attempts: number;
  max_attempts: number;
  retry_count?: number;
  max_retries?: number;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  idempotency_key?: string | null;
}

export const JOB_QUEUE_SELECT = [
  'id',
  'order_id',
  'user_id',
  'brand_id',
  'type',
  'kind',
  'status',
  'payload',
  'error',
  'attempts',
  'max_attempts',
  'scheduled_for',
  'created_at',
  'updated_at',
].join(', ');

export function inferKindFromType(type: JobQueueType): JobKind {
  if (type.includes('image') || type === 'render_images') return 'image';
  if (type.includes('carousel') || type === 'render_carousels') return 'carousel';
  if (type.includes('video') || type === 'generate_video') return 'video';
  if (type === 'copy' || type === 'vision' || type === 'generate_texts') return 'text';
  return 'unknown';
}

export function normalizeStatus(status: string): JobQueueStatus {
  switch (status) {
    case 'processing':
    case 'running':
      return 'running';
    case 'done':
    case 'completed':
      return 'completed';
    case 'error':
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
}

export function getJobTypeLabel(type: JobQueueType): string {
  const labels: Record<JobQueueType, string> = {
    api_generate_image: "Génération d'image (API)",
    render_images: 'Rendu d\'images',
    render_carousels: 'Rendu de carrousels',
    generate_texts: 'Génération de texte',
    generate_video: 'Génération de vidéo',
    copy: 'Rédaction',
    vision: 'Brief visuel',
    upload: 'Upload Cloudinary',
    thumb: 'Vignettes',
  };

  return labels[type] ?? type;
}

export interface ClaimedJob {
  id: string;
  order_id: string | null;
  user_id: string;
  type: JobQueueType;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export interface JobQueueStats {
  status: JobQueueStatus;
  count: number;
  retried_count: number;
  max_retries_reached: number;
  oldest_job: string | null;
  latest_update: string | null;
}
