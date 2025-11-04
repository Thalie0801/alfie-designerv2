-- Phase 6: Job Queue System
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('generate_texts', 'render_images', 'render_carousels', 'generate_video')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  payload jsonb NOT NULL,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_order ON job_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_user ON job_queue(user_id);

-- Enable RLS
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own jobs"
  ON job_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all jobs"
  ON job_queue FOR ALL
  USING (true);