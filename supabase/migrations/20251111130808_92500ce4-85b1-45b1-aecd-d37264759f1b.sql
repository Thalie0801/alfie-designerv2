-- Étape 1: Ajouter colonnes manquantes à job_queue
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS kind text NULL;
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS brand_id uuid NULL;
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3;

-- Backfill kind pour éviter "undefined" dans l'UI
UPDATE job_queue SET kind = 
  CASE
    WHEN type IN ('api_generate_image','render_images') THEN 'image'
    WHEN type IN ('render_carousels','generate_texts') THEN 'carousel'
    WHEN type IN ('generate_video') THEN 'video'
    ELSE NULL
  END
WHERE kind IS NULL;

-- Indices pour performance
CREATE INDEX IF NOT EXISTS ix_job_queue_status_created ON job_queue(status, created_at);
CREATE INDEX IF NOT EXISTS ix_job_queue_user ON job_queue(user_id);

-- Étape 2: Policy service_role permissive (pour claim_next_job)
DROP POLICY IF EXISTS jq_service_all ON public.job_queue;
CREATE POLICY jq_service_all ON public.job_queue 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Vérifier que claim_next_job est SECURITY DEFINER
DROP FUNCTION IF EXISTS public.claim_next_job() CASCADE;
CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS TABLE(id uuid, order_id uuid, user_id uuid, type text, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT jq.id
    FROM job_queue jq
    WHERE jq.status = 'queued'
    ORDER BY jq.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue jq
  SET 
    status = 'running',
    updated_at = now(),
    attempts = COALESCE(attempts, 0) + 1
  FROM claimed
  WHERE jq.id = claimed.id
  RETURNING jq.id, jq.order_id, jq.user_id, jq.type, jq.payload;
END;
$$;