-- Force suppression de l'ancienne contrainte (si elle existe encore)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_order_items_order_type'
  ) THEN
    ALTER TABLE order_items DROP CONSTRAINT uq_order_items_order_type;
  END IF;
END $$;

-- Ajouter la nouvelle contrainte unique sur (order_id, type, sequence_number)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_order_items_order_type_seq'
  ) THEN
    ALTER TABLE order_items 
    ADD CONSTRAINT uq_order_items_order_type_seq 
    UNIQUE (order_id, type, sequence_number);
  END IF;
END $$;