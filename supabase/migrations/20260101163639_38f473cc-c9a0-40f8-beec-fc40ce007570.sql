-- Create function to recover stuck steps (running > 2 minutes)
CREATE OR REPLACE FUNCTION public.recover_stuck_steps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recovered_count INTEGER;
BEGIN
  -- Update stuck steps back to 'queued' for retry
  WITH recovered AS (
    UPDATE job_steps
    SET 
      status = 'queued', 
      attempt = attempt + 1,
      started_at = NULL,
      updated_at = now(),
      error = COALESCE(error, '') || ' [auto-recovered from stuck running state]'
    WHERE status = 'running'
      AND started_at < now() - interval '2 minutes'
      AND attempt < max_attempts
    RETURNING id
  )
  SELECT COUNT(*) INTO recovered_count FROM recovered;
  
  -- Mark as failed if max attempts exceeded
  UPDATE job_steps
  SET 
    status = 'failed',
    error = 'Max retries exceeded (step stuck in running state)',
    ended_at = now(),
    updated_at = now()
  WHERE status = 'running'
    AND started_at < now() - interval '2 minutes'
    AND attempt >= max_attempts;
    
  RETURN recovered_count;
END;
$$;