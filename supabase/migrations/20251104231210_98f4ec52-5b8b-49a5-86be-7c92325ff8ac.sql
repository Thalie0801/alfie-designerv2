-- Vue unifiée pour la bibliothèque (seulement URLs Cloudinary valides)
CREATE OR REPLACE VIEW public.library_assets_view AS
  SELECT
    id,
    user_id,
    brand_id,
    'image'::text AS type,
    output_url AS url,
    thumbnail_url AS thumb_url,
    created_at,
    metadata
  FROM public.media_generations
  WHERE output_url LIKE 'https://res.cloudinary.com/%'
    AND status = 'completed'
UNION ALL
  SELECT
    id,
    user_id,
    brand_id,
    type,
    cloudinary_url AS url,
    cloudinary_url AS thumb_url,
    created_at,
    metadata
  FROM public.library_assets
  WHERE cloudinary_url LIKE 'https://res.cloudinary.com/%';

-- Nettoyer les assets en base64 (< 7 jours)
-- D'abord mettre à NULL les références dans job_sets
UPDATE job_sets 
SET style_ref_asset_id = NULL 
WHERE style_ref_asset_id IN (
  SELECT id FROM media_generations 
  WHERE output_url LIKE 'data:image/%'
    AND created_at > NOW() - INTERVAL '7 days'
);

-- Puis supprimer les assets en base64
DELETE FROM media_generations 
WHERE output_url LIKE 'data:image/%'
  AND created_at > NOW() - INTERVAL '7 days';

DELETE FROM library_assets 
WHERE cloudinary_url LIKE 'data:image/%'
  AND created_at > NOW() - INTERVAL '7 days';