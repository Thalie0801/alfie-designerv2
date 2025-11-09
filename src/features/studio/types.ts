export type JobEntry = {
  id: string;
  type: string;
  status: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  error?: string | null;
  error_message?: string | null;
  payload?: unknown;
  user_id: string;
  retry_count: number;
};

export type MediaEntry = {
  id: string;
  type: string;
  cloudinary_url: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  brand_id?: string | null;
  order_id?: string | null;
  status?: string | null;
};
