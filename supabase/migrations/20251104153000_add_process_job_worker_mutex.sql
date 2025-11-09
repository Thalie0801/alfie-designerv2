-- Concurrency guard for process-job-worker
CREATE TABLE IF NOT EXISTS public.process_job_worker_mutex (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  locked_by text,
  locked_until timestamptz
);

CREATE OR REPLACE FUNCTION public.acquire_process_job_worker_mutex(
  p_owner text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_ttl integer := GREATEST(COALESCE(p_ttl_seconds, 0), 60);
  v_locked_until timestamptz := v_now + make_interval(secs => v_ttl);
BEGIN
  UPDATE public.process_job_worker_mutex
  SET locked_by = p_owner,
      locked_until = v_locked_until
  WHERE id = 1
    AND (locked_until IS NULL OR locked_until <= v_now);

  IF FOUND THEN
    RETURN true;
  END IF;

  BEGIN
    INSERT INTO public.process_job_worker_mutex(id, locked_by, locked_until)
    VALUES (1, p_owner, v_locked_until);
    RETURN true;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN false;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_process_job_worker_mutex(
  p_owner text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.process_job_worker_mutex
  SET locked_by = NULL,
      locked_until = NULL
  WHERE id = 1
    AND locked_by = p_owner;
END;
$$;
