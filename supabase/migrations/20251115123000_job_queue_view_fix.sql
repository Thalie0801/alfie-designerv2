-- Archivage + versioning (idempotent)
ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS job_version integer DEFAULT 2;

-- Vue: jobs actifs (non archivés)
CREATE OR REPLACE VIEW v_job_queue_active AS
SELECT
  id, user_id, order_id, type, kind, brand_id, status, payload, result, error,
  created_at, updated_at, retry_count, max_retries, attempts, max_attempts,
  idempotency_key, COALESCE(is_archived,false) AS is_archived, archived_at, job_version
FROM job_queue
WHERE COALESCE(is_archived,false) = false;

ALTER VIEW v_job_queue_active OWNER TO postgres;

-- Permissions utiles (si besoin)
GRANT SELECT ON v_job_queue_active TO authenticated, service_role;
