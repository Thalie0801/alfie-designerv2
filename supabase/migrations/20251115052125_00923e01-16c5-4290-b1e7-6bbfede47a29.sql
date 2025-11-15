-- Phase 2: Nettoyage des jobs bloqués et orders orphelines (corrigé)

-- Marquer tous les jobs en queue ou running comme failed avec raison de nettoyage
UPDATE job_queue 
SET 
  status = 'failed',
  error = 'Cleanup: Refonte Studio - Jobs réinitialisés',
  updated_at = NOW()
WHERE status IN ('queued', 'running');

-- Mettre à jour les orders en pending/processing sans assets complétés
UPDATE orders 
SET 
  status = 'failed',
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{cleanup_reason}',
    '"refonte_studio"'::jsonb
  ),
  updated_at = NOW()
WHERE status IN ('pending', 'processing')
  AND NOT EXISTS (
    SELECT 1 FROM library_assets 
    WHERE library_assets.order_id = orders.id
  );