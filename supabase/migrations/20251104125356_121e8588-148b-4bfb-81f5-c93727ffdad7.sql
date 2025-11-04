-- Migration: Fix order_items unique constraint + add atomic job claim function

-- 1) Ensure sequence_number column exists with default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'sequence_number'
  ) THEN
    ALTER TABLE order_items ADD COLUMN sequence_number integer NOT NULL DEFAULT 1;
  END IF;
END$$;

-- 2) Drop old constraint that prevents multiple items of same type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_order_items_order_type'
  ) THEN
    ALTER TABLE order_items DROP CONSTRAINT uq_order_items_order_type;
  END IF;
END$$;

-- 3) Add new constraint allowing multiple items with different sequence_number
ALTER TABLE order_items 
  ADD CONSTRAINT uq_order_items_order_type_seq 
  UNIQUE (order_id, type, sequence_number);

-- 4) Create atomic job claim function (prevents race conditions)
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS TABLE (
  id uuid,
  order_id uuid,
  user_id uuid,
  type text,
  payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    updated_at = now()
  FROM claimed
  WHERE jq.id = claimed.id
  RETURNING jq.id, jq.order_id, jq.user_id, jq.type, jq.payload;
END;
$$;