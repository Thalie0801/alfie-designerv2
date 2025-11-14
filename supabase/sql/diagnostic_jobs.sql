-- Diagnostic : jobs bloqués et cohérence des commandes
-- ----------------------------------------------------
-- Jobs en attente ou en cours depuis plus de 10 minutes
SELECT
  id,
  order_id,
  user_id,
  brand_id,
  type,
  status,
  priority,
  created_at,
  started_at,
  updated_at
FROM job_queue
WHERE status IN ('pending', 'processing')
  AND (
    (started_at IS NOT NULL AND started_at < NOW() - INTERVAL '10 minutes')
    OR (started_at IS NULL AND created_at < NOW() - INTERVAL '10 minutes')
  )
ORDER BY created_at ASC;

-- Commandes sans job associé (status encore en attente)
SELECT
  o.id AS order_id,
  o.user_id,
  o.brand_id,
  o.status,
  o.created_at
FROM orders o
LEFT JOIN job_queue jq ON jq.order_id = o.id
WHERE jq.id IS NULL
  AND o.status IN ('pending', 'visual_generation')
ORDER BY o.created_at DESC;

-- Marques ayant dépassé leur quota d'images
SELECT
  id AS brand_id,
  user_id,
  images_used,
  quota_images,
  (images_used - quota_images) AS over_quota
FROM brands
WHERE quota_images IS NOT NULL
  AND images_used > quota_images
ORDER BY over_quota DESC;


-- Réparation : remettre la file en état
-- ------------------------------------
-- 1. Réinitialiser les jobs bloqués en processing depuis plus de 15 minutes
UPDATE job_queue
SET
  status = 'pending',
  started_at = NULL,
  error = NULL,
  updated_at = NOW()
WHERE status = 'processing'
  AND started_at IS NOT NULL
  AND started_at < NOW() - INTERVAL '15 minutes';

-- 2. Supprimer les jobs orphelins sans order_id
DELETE FROM job_queue
WHERE order_id IS NULL
  AND created_at < NOW() - INTERVAL '15 minutes';

-- 3. Recréer un job "copy" pour les commandes en attente sans job
INSERT INTO job_queue (id, user_id, brand_id, order_id, type, status, priority, payload)
SELECT
  gen_random_uuid(),
  o.user_id,
  o.brand_id,
  o.id,
  'copy' AS type,
  'pending' AS status,
  1 AS priority,
  jsonb_build_object(
    'prompt', COALESCE(o.brief_json->>'prompt', o.metadata->>'prompt', ''),
    'format', COALESCE(o.brief_json->>'format', o.metadata->>'format', 'instagram_post'),
    'metadata', COALESCE(o.metadata, '{}')
  )
FROM orders o
LEFT JOIN job_queue jq ON jq.order_id = o.id
WHERE o.status IN ('pending', 'visual_generation')
  AND jq.id IS NULL;
