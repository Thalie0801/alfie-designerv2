-- Débloquer les jobs coincés
UPDATE job_queue
SET 
  status = 'queued',
  updated_at = now()
WHERE status = 'running'
  AND updated_at < now() - interval '1 minute';

-- Appeler la fonction de reset pour nettoyer tous les jobs bloqués
SELECT reset_stuck_jobs(1);