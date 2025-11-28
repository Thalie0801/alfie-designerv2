-- ============================================
-- MIGRATION SÉCURITÉ : Correction RLS et Vues
-- ============================================

-- 1. CORRECTION job_queue : Supprimer politiques trop permissives
-- ================================================================

DROP POLICY IF EXISTS "Service can manage all jobs" ON job_queue;
DROP POLICY IF EXISTS "service_role_manages_jobs" ON job_queue;

-- Note: service_role bypass RLS automatiquement, pas besoin de policy explicite
-- Les policies existantes "Users can view their own jobs" et "users_view_own_jobs" sont correctes

-- 2. CORRECTION VUES : Convertir en SECURITY INVOKER avec filtrage auth.uid()
-- ============================================================================

-- Vue library_assets_view : Filtrer par user_id
DROP VIEW IF EXISTS library_assets_view CASCADE;
CREATE VIEW library_assets_view WITH (security_invoker = true) AS
SELECT 
  media_generations.id,
  media_generations.user_id,
  media_generations.brand_id,
  'image'::text AS type,
  media_generations.output_url AS url,
  media_generations.thumbnail_url AS thumb_url,
  media_generations.created_at,
  media_generations.metadata
FROM media_generations
WHERE media_generations.output_url LIKE 'https://res.cloudinary.com/%'
  AND media_generations.status = 'completed'
  AND media_generations.user_id = auth.uid()
UNION ALL
SELECT 
  library_assets.id,
  library_assets.user_id,
  library_assets.brand_id,
  library_assets.type,
  library_assets.cloudinary_url AS url,
  library_assets.cloudinary_url AS thumb_url,
  library_assets.created_at,
  library_assets.metadata
FROM library_assets
WHERE library_assets.cloudinary_url LIKE 'https://res.cloudinary.com/%'
  AND library_assets.user_id = auth.uid();

-- Vue v_brand_quota_current : Filtrer par user_id de la brand
DROP VIEW IF EXISTS v_brand_quota_current CASCADE;
CREATE VIEW v_brand_quota_current WITH (security_invoker = true) AS
SELECT 
  b.id AS brand_id,
  b.name,
  b.plan,
  b.quota_images,
  b.quota_videos,
  b.quota_woofs,
  b.images_used,
  b.videos_used,
  b.woofs_used,
  CASE WHEN b.quota_images > 0 THEN round((b.images_used::numeric / b.quota_images::numeric) * 100, 0) ELSE 0 END AS images_usage_pct,
  CASE WHEN b.quota_videos > 0 THEN round((b.videos_used::numeric / b.quota_videos::numeric) * 100, 0) ELSE 0 END AS videos_usage_pct,
  CASE WHEN b.quota_woofs > 0 THEN round((b.woofs_used::numeric / b.quota_woofs::numeric) * 100, 0) ELSE 0 END AS woofs_usage_pct,
  b.resets_on,
  b.user_id
FROM brands b
WHERE b.user_id = auth.uid();

-- Vue v_unified_assets : Filtrer via brands.user_id
DROP VIEW IF EXISTS v_unified_assets CASCADE;
CREATE VIEW v_unified_assets WITH (security_invoker = true) AS
SELECT 
  assets.id,
  assets.brand_id,
  (assets.meta ->> 'public_url')::text AS output_url,
  (assets.meta ->> 'job_set_id')::uuid AS job_set_id,
  assets.mime AS type,
  assets.meta,
  assets.created_at
FROM assets
WHERE EXISTS (SELECT 1 FROM brands WHERE brands.id = assets.brand_id AND brands.user_id = auth.uid())
UNION ALL
SELECT 
  media_generations.id,
  media_generations.brand_id,
  media_generations.output_url,
  (media_generations.metadata ->> 'job_set_id')::uuid AS job_set_id,
  media_generations.type,
  media_generations.metadata AS meta,
  media_generations.created_at
FROM media_generations
WHERE media_generations.user_id = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM assets WHERE assets.id = media_generations.id);