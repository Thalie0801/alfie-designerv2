-- Harden job_queue for reliable processing

ALTER TABLE public.job_queue
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS job_queue_idempotent_unique
  ON public.job_queue (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_queue_status_created_idx
  ON public.job_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS job_queue_running_idx
  ON public.job_queue (started_at)
  WHERE status = 'running';

-- Replace claim_next_job with worker-aware variant
DROP FUNCTION IF EXISTS public.claim_next_job();

CREATE OR REPLACE FUNCTION public.claim_next_job(worker_id text)
RETURNS public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.job_queue%ROWTYPE;
BEGIN
  WITH next_job AS (
    SELECT jq.id
    FROM public.job_queue jq
    WHERE jq.status = 'queued'
    ORDER BY jq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.job_queue jq
  SET
    status = 'running',
    locked_by = worker_id,
    started_at = NOW(),
    attempts = COALESCE(jq.attempts, 0) + 1,
    updated_at = NOW()
  FROM next_job
  WHERE jq.id = next_job.id
  RETURNING jq.* INTO claimed;

  RETURN claimed;
END;
$$;

COMMENT ON FUNCTION public.claim_next_job(text) IS 'Atomically claim the next queued job for a worker';

-- Watchdog to reset or fail stuck jobs
CREATE OR REPLACE FUNCTION public.reset_stuck_jobs(
  timeout_minutes integer DEFAULT 15,
  max_attempts integer DEFAULT 3
)
RETURNS TABLE(reset_count integer, failed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reset_total integer := 0;
  failed_total integer := 0;
BEGIN
  WITH reset_jobs AS (
    UPDATE public.job_queue
    SET
      status = 'queued',
      locked_by = NULL,
      started_at = NULL,
      updated_at = NOW()
    WHERE status = 'running'
      AND started_at IS NOT NULL
      AND started_at < NOW() - (timeout_minutes || ' minutes')::interval
      AND attempts < max_attempts
    RETURNING id
  )
  SELECT COUNT(*) INTO reset_total FROM reset_jobs;

  WITH failed_jobs AS (
    UPDATE public.job_queue
    SET
      status = 'failed',
      error = COALESCE(error, 'watchdog: timeout exceeded'),
      locked_by = NULL,
      started_at = NULL,
      updated_at = NOW()
    WHERE status = 'running'
      AND started_at IS NOT NULL
      AND started_at < NOW() - (timeout_minutes || ' minutes')::interval
      AND attempts >= max_attempts
    RETURNING id
  )
  SELECT COUNT(*) INTO failed_total FROM failed_jobs;

  RETURN QUERY SELECT reset_total, failed_total;
END;
$$;

COMMENT ON FUNCTION public.reset_stuck_jobs(integer, integer)
  IS 'Reset running jobs that exceeded timeout or mark them failed when attempts are exhausted';
