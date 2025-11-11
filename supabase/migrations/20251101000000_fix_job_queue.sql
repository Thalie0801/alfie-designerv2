-- ============================================================================
-- FIX: Schéma job_queue + RLS + claim_next_job
-- Résout: colonnes manquantes, jobs bloqués, worker inactif
-- ============================================================================
-- ÉTAPE 1: Ajouter les colonnes manquantes
-- ============================================================================
ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS kind text NULL,
  ADD COLUMN IF NOT EXISTS brand_id uuid NULL,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3;

-- Backfill kind depuis type (pour compatibilité Studio)
UPDATE job_queue
SET kind = CASE
  WHEN type IN ('api_generate_image', 'render_images') THEN 'image'
  WHEN type IN ('render_carousels', 'generate_texts') THEN 'carousel'
  WHEN type IN ('generate_video') THEN 'video'
  WHEN type IN ('copy', 'vision') THEN 'text'
  ELSE 'unknown'
END
WHERE kind IS NULL;

-- ÉTAPE 2: Normaliser les statuts (aligner sur queued/running/completed/failed)
-- ============================================================================
UPDATE job_queue SET status = 'running' WHERE status = 'processing';
UPDATE job_queue SET status = 'completed' WHERE status = 'done';
UPDATE job_queue SET status = 'failed' WHERE status = 'error';

-- ÉTAPE 3: Ajouter les index manquants pour performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS ix_job_queue_status_created ON job_queue(status, created_at);
CREATE INDEX IF NOT EXISTS ix_job_queue_user ON job_queue(user_id);
CREATE INDEX IF NOT EXISTS ix_job_queue_order ON job_queue(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_job_queue_brand ON job_queue(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_job_queue_claimable
  ON job_queue (created_at, id)
  WHERE status = 'queued'
    AND (scheduled_for IS NULL OR scheduled_for <= now())
    AND attempts < max_attempts;
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_queue_idempotency
  ON job_queue (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ÉTAPE 4: Corriger les politiques RLS
-- ============================================================================
DROP POLICY IF EXISTS jq_service_all ON job_queue;
DROP POLICY IF EXISTS jq_user_select ON job_queue;
DROP POLICY IF EXISTS jq_user_insert ON job_queue;
DROP POLICY IF EXISTS jq_user_update ON job_queue;

CREATE POLICY jq_service_all ON job_queue
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY jq_user_select ON job_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY jq_user_insert ON job_queue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY jq_user_update ON job_queue
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- ÉTAPE 5: Recréer la fonction claim_next_job (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS TABLE (
  id uuid,
  order_id uuid,
  user_id uuid,
  type text,
  payload jsonb,
  attempts integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
SET search_path = public
AS $$
DECLARE
  claimed_id uuid;
BEGIN
  WITH claimed AS (
    SELECT jq.id
    FROM job_queue jq
    WHERE jq.status = 'queued'
      AND jq.attempts < jq.max_attempts
      AND (jq.scheduled_for IS NULL OR jq.scheduled_for <= now())
    ORDER BY jq.created_at ASC, jq.id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue j
     SET status = 'running',
         attempts = j.attempts + 1,
         updated_at = now()
         -- , started_at = now()
  FROM candidate c
  WHERE j.id = c.id
  RETURNING j.id,
            j.order_id,
            j.user_id,
            j.type,
            j.payload,
            j.attempts,
            j.max_attempts;
      AND (jq.scheduled_for IS NULL OR jq.scheduled_for <= NOW())
    ORDER BY jq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue jq
  SET status = 'running',
      attempts = attempts + 1,
      updated_at = NOW()
  FROM claimed
  WHERE jq.id = claimed.id
  RETURNING jq.id,
            jq.order_id,
            jq.user_id,
            jq.type,
            jq.payload,
            jq.attempts,
            jq.max_attempts
    INTO id, order_id, user_id, type, payload, attempts, max_attempts;

  IF FOUND THEN
    RETURN NEXT;
  END IF;
END;
$$;

 REVOKE ALL ON FUNCTION claim_next_job() FROM PUBLIC;
 REVOKE ALL ON FUNCTION claim_next_job() FROM authenticated;
 GRANT EXECUTE ON FUNCTION claim_next_job() TO service_role;
GRANT EXECUTE ON FUNCTION claim_next_job() TO service_role;
GRANT EXECUTE ON FUNCTION claim_next_job() TO authenticated;

-- ÉTAPE 6: Ajouter une fonction pour débloquer les jobs stuck
-- ============================================================================
CREATE OR REPLACE FUNCTION unlock_stuck_jobs(stuck_minutes integer DEFAULT 10)
RETURNS TABLE (
  job_id uuid,
  previous_status text,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET status = 'queued',
      updated_at = NOW()
  WHERE status = 'running'
    AND updated_at < NOW() - (stuck_minutes || ' minutes')::interval
  RETURNING id AS job_id,
            'running' AS previous_status,
            'queued' AS new_status;
END;
$$;

 REVOKE ALL ON FUNCTION unlock_stuck_jobs(integer) FROM PUBLIC;
 REVOKE ALL ON FUNCTION unlock_stuck_jobs(integer) FROM authenticated;
 GRANT EXECUTE ON FUNCTION unlock_stuck_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION unlock_stuck_jobs(integer) TO service_role;

-- ÉTAPE 7: Fonction pour marquer les jobs expirés comme failed
-- ============================================================================
CREATE OR REPLACE FUNCTION fail_expired_jobs(max_age_hours integer DEFAULT 24)
RETURNS TABLE (
  job_id uuid,
  job_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET status = 'failed',
      error = 'Job expired after ' || max_age_hours || ' hours',
      updated_at = NOW()
  WHERE status = 'queued'
    AND created_at < NOW() - (max_age_hours || ' hours')::interval
  RETURNING id AS job_id,
            type AS job_type;
END;
$$;

 REVOKE ALL ON FUNCTION fail_expired_jobs(integer) FROM PUBLIC;
 REVOKE ALL ON FUNCTION fail_expired_jobs(integer) FROM authenticated;
 GRANT EXECUTE ON FUNCTION fail_expired_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION fail_expired_jobs(integer) TO service_role;

-- ÉTAPE 8: Ajouter une colonne scheduled_for si absente (pour retry delays)
-- ============================================================================
ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_job_queue_scheduled
  ON job_queue(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status = 'queued';

-- ÉTAPE 9: Synchroniser retry_count si la colonne existe encore
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'job_queue'
      AND column_name = 'retry_count'
  ) THEN
    UPDATE job_queue
    SET retry_count = attempts
    WHERE retry_count IS DISTINCT FROM attempts;
  END IF;
END
$$;

-- ÉTAPE 10: Vue helper pour le monitoring
-- ============================================================================
CREATE OR REPLACE VIEW job_queue_stats AS
SELECT
  status,
  COUNT(*) AS count,
  COUNT(CASE WHEN attempts > 0 THEN 1 END) AS retried_count,
  COUNT(CASE WHEN attempts >= max_attempts THEN 1 END) AS max_retries_reached,
  MIN(created_at) AS oldest_job,
  MAX(updated_at) AS latest_update
FROM job_queue
GROUP BY status;

GRANT SELECT ON job_queue_stats TO authenticated, service_role;

CREATE OR REPLACE VIEW job_queue_queued_count AS
SELECT COUNT(*)::int AS queued
FROM job_queue
WHERE status = 'queued';

GRANT SELECT ON job_queue_queued_count TO authenticated, service_role;

-- ÉTAPE 11: Réinitialiser les jobs bloqués depuis plus de 5 minutes
-- ============================================================================
UPDATE job_queue
SET status = 'queued',
    attempts = GREATEST(0, attempts - 1),
    updated_at = NOW()
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '5 minutes';

-- Journaliser l'état courant
DO $$
DECLARE
  queued_count integer;
  running_count integer;
  completed_count integer;
  failed_count integer;
BEGIN
  SELECT COUNT(*) INTO queued_count FROM job_queue WHERE status = 'queued';
  SELECT COUNT(*) INTO running_count FROM job_queue WHERE status = 'running';
  SELECT COUNT(*) INTO completed_count FROM job_queue WHERE status = 'completed';
  SELECT COUNT(*) INTO failed_count FROM job_queue WHERE status = 'failed';

  RAISE NOTICE 'Job queue status after fix:';
  RAISE NOTICE '  Queued: %', queued_count;
  RAISE NOTICE '  Running: %', running_count;
  RAISE NOTICE '  Completed: %', completed_count;
  RAISE NOTICE '  Failed: %', failed_count;
END
$$;
-- ============================================================================
-- Fin du correctif
-- ============================================================================
