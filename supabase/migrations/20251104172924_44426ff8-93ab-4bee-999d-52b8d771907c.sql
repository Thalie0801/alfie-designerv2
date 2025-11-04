-- Migration: Fix deduplication by order_item_id for render jobs
CREATE OR REPLACE FUNCTION public.enqueue_render_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.type = 'generate_texts'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Create one render job per order_item that had texts generated
    INSERT INTO job_queue (user_id, order_id, type, status, payload)
    SELECT 
      NEW.user_id,
      oi.order_id,
      CASE WHEN oi.type = 'carousel' THEN 'render_carousels' ELSE 'render_images' END,
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
      -- Deduplicate strictly by order_item_id
      AND NOT EXISTS (
        SELECT 1 FROM job_queue jq
        WHERE jq.type = CASE WHEN oi.type = 'carousel' THEN 'render_carousels' ELSE 'render_images' END
          AND jq.status IN ('queued','running')
          AND (jq.payload->>'orderItemId')::uuid = oi.id
      );

    -- Keep current status alignment post-enqueue
    UPDATE order_items
    SET status = 'text_generated'
    WHERE order_id = NEW.order_id
      AND status IN ('pending','text_generated');
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger to ensure it points to the latest function
DROP TRIGGER IF EXISTS trigger_enqueue_render_jobs ON job_queue;
CREATE TRIGGER trigger_enqueue_render_jobs
  AFTER UPDATE ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_render_jobs();