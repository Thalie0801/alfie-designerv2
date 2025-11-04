-- ============================================================
-- Migration: Fix cascade rendering & realtime for library_assets
-- ============================================================

-- 1) Créer le trigger pour auto-cascade après generate_texts
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_render_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Déclencher uniquement si:
  -- - UPDATE sur job_queue
  -- - type = 'generate_texts'
  -- - statut devient 'completed' (transition)
  IF TG_OP = 'UPDATE'
     AND NEW.type = 'generate_texts'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Insérer jobs de rendu pour chaque order_item
    INSERT INTO job_queue (user_id, order_id, type, status, payload)
    SELECT 
      NEW.user_id,
      oi.order_id,
      CASE 
        WHEN oi.type = 'carousel' THEN 'render_carousels'
        ELSE 'render_images'
      END,
      'queued',
      jsonb_build_object(
        'userId', NEW.user_id,
        'orderId', oi.order_id,
        'orderItemId', oi.id,
        'brief', oi.brief_json,
        'brandId', (NEW.payload->>'brandId')::uuid,
        'imageIndex', oi.sequence_number,
        'carouselIndex', oi.sequence_number
      )
    FROM order_items oi
    WHERE oi.order_id = NEW.order_id
      AND oi.status = 'text_generated'
      -- 🛡️ GARDE-FOU: ne pas recréer si job déjà en cours
      AND NOT EXISTS (
        SELECT 1 FROM job_queue jq
        WHERE jq.order_id = oi.order_id
          AND jq.type = CASE WHEN oi.type = 'carousel' THEN 'render_carousels' ELSE 'render_images' END
          AND jq.status IN ('queued', 'running')
      );

    -- Marquer les order_items comme ready après création des jobs
    UPDATE order_items
    SET status = 'text_generated'
    WHERE order_id = NEW.order_id
      AND status IN ('pending', 'text_generated');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur job_queue
DROP TRIGGER IF EXISTS trigger_enqueue_render_jobs ON job_queue;
CREATE TRIGGER trigger_enqueue_render_jobs
  AFTER UPDATE ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_render_jobs();

-- 2) Activer Realtime sur library_assets
-- ============================================================

-- Ajouter library_assets à la publication realtime (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'library_assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.library_assets;
  END IF;
END $$;

-- 3) Backfill order_id pour assets déjà générés
-- ============================================================

-- Remplir order_id depuis metadata->>'orderId' (idempotent)
UPDATE library_assets
SET order_id = NULLIF(metadata->>'orderId', '')::uuid
WHERE order_id IS NULL
  AND metadata ? 'orderId'
  AND metadata->>'orderId' IS NOT NULL
  AND metadata->>'orderId' != '';

-- Remplir order_item_id depuis metadata->>'orderItemId' (idempotent)
UPDATE library_assets
SET order_item_id = NULLIF(metadata->>'orderItemId', '')::uuid
WHERE order_item_id IS NULL
  AND metadata ? 'orderItemId'
  AND metadata->>'orderItemId' IS NOT NULL
  AND metadata->>'orderItemId' != '';

-- ============================================================
-- Résultat attendu:
-- - Les jobs de rendu sont automatiquement créés après generate_texts
-- - Les assets s'affichent en temps réel dans l'UI via Realtime
-- - Les assets existants sont rétro-liés à leurs commandes
-- ============================================================