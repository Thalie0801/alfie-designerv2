-- Ensure archival columns exist on job_queue and expose active rows through a dedicated view
ALTER TABLE public.job_queue
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS job_version integer DEFAULT 2;

CREATE OR REPLACE VIEW public.v_job_queue_active AS
SELECT
  id,
  user_id,
  order_id,
  type,
  kind,
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
  COALESCE(is_archived, false) AS is_archived,
  archived_at,
  job_version
FROM public.job_queue
WHERE COALESCE(is_archived, false) = false;

ALTER VIEW public.v_job_queue_active OWNER TO postgres;
