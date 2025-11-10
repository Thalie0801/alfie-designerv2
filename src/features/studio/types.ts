export type JobEntry = {
  id: string;
  type: string;
  status: string;
  kind?: 'image' | 'carousel' | 'video';
  brand_id?: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  error?: string | null;
  error_message?: string | null;
  payload?: unknown;
  user_id: string;
  retry_count: number;
  max_retries?: number;
  attempts?: number;
  max_attempts?: number;
};

export type MediaEntry = {
  id: string;
  type: string;
  cloudinary_url: string | null;
  secure_url?: string | null;
  preview_url?: string | null;
  metadata?: Record<string, any> | null;
  meta?: Record<string, any> | null;
  created_at: string;
  brand_id?: string | null;
  order_id?: string | null;
  status?: string | null;
};
