-- Contraintes d'idempotence pour éviter les doublons
-- Un seul job "generate_texts" par order (par type et statut)
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_queue_order_type_status
  ON job_queue(order_id, type, status)
  WHERE status IN ('queued', 'processing');

-- Un seul item par type dans un order
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_order_type
  ON order_items(order_id, type);

-- Index de performance pour lectures fréquentes
CREATE INDEX IF NOT EXISTS ix_orders_user_brand ON orders(user_id, brand_id);
CREATE INDEX IF NOT EXISTS ix_job_queue_status_type ON job_queue(status, type) WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS ix_sessions_order ON alfie_conversation_sessions(order_id);
CREATE INDEX IF NOT EXISTS ix_job_queue_created ON job_queue(created_at DESC);