-- Phase 2: Contraintes DB pour empêcher les doublons
-- 1. Contrainte unique sur jobs (job_set_id, index_in_set)
ALTER TABLE jobs
  ADD CONSTRAINT jobs_unique_in_set 
  UNIQUE (job_set_id, index_in_set);

-- Phase 3: Vue unifiée pour quotas (source unique Dashboard + Chat)
-- Vue centralisée lue par Chat + Dashboard
-- La sécurité est gérée par les RLS policies de la table brands sous-jacente
CREATE OR REPLACE VIEW v_brand_quota_current AS
SELECT 
  b.id as brand_id,
  b.name,
  b.plan,
  b.quota_images,
  b.quota_videos,
  b.quota_woofs,
  b.images_used,
  b.videos_used,
  b.woofs_used,
  CASE 
    WHEN b.quota_images > 0 THEN ROUND((b.images_used::numeric / b.quota_images::numeric) * 100, 0)
    ELSE 0 
  END as images_usage_pct,
  CASE 
    WHEN b.quota_videos > 0 THEN ROUND((b.videos_used::numeric / b.quota_videos::numeric) * 100, 0)
    ELSE 0 
  END as videos_usage_pct,
  CASE 
    WHEN b.quota_woofs > 0 THEN ROUND((b.woofs_used::numeric / b.quota_woofs::numeric) * 100, 0)
    ELSE 0 
  END as woofs_usage_pct,
  b.resets_on,
  b.user_id
FROM brands b;