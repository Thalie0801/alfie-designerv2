-- Débloquer jobs stuck
update job_queue
set status = 'pending',
    locked_by = null,
    locked_at = null,
    attempts = coalesce(attempts, 0) + 1
where status = 'processing'
  and locked_at < now() - interval '10 minutes';

-- Exécuter en priorité
update job_queue
set next_run_at = now()
where status = 'pending'
  and (next_run_at is null or next_run_at > now());
