-- Nettoyer les job_sets bloqués depuis le 2 novembre 2024
-- Marquer comme failed et rembourser les quotas

DO $$
DECLARE
  v_job_set_id uuid;
  v_brand_id uuid;
  v_count int;
BEGIN
  -- Identifier les job_sets bloqués depuis le 2 nov avec jobs non terminés
  FOR v_job_set_id, v_brand_id, v_count IN
    SELECT DISTINCT js.id, js.brand_id, js.total
    FROM job_sets js
    JOIN jobs j ON j.job_set_id = js.id
    WHERE js.created_at < '2024-11-03'::date
      AND js.status IN ('queued', 'processing')
      AND j.status IN ('queued', 'processing')
  LOOP
    -- Marquer le job_set comme failed
    UPDATE job_sets 
    SET status = 'failed', updated_at = now()
    WHERE id = v_job_set_id;

    -- Marquer tous les jobs associés comme failed
    UPDATE jobs
    SET status = 'failed', error = 'Job set marked as failed due to timeout', finished_at = now()
    WHERE job_set_id = v_job_set_id AND status IN ('queued', 'processing');

    -- Rembourser les quotas
    PERFORM refund_brand_quotas(v_brand_id, v_count, 0, 0);

    RAISE NOTICE 'Cleaned up job_set % for brand % (% visuals refunded)', v_job_set_id, v_brand_id, v_count;
  END LOOP;
END $$;