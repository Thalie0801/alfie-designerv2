-- Assurer que tous les champs de quotas ont DEFAULT 0 (jamais NULL)
ALTER TABLE public.profiles
  ALTER COLUMN woofs_consumed_this_month SET DEFAULT 0,
  ALTER COLUMN quota_videos SET DEFAULT 0,
  ALTER COLUMN generations_this_month SET DEFAULT 0,
  ALTER COLUMN quota_visuals_per_month SET DEFAULT 0;

ALTER TABLE public.brands
  ALTER COLUMN woofs_used SET DEFAULT 0,
  ALTER COLUMN quota_woofs SET DEFAULT 0,
  ALTER COLUMN images_used SET DEFAULT 0,
  ALTER COLUMN quota_images SET DEFAULT 0,
  ALTER COLUMN videos_used SET DEFAULT 0,
  ALTER COLUMN quota_videos SET DEFAULT 0;

-- Mettre à jour les valeurs NULL existantes
UPDATE public.profiles
SET 
  woofs_consumed_this_month = COALESCE(woofs_consumed_this_month, 0),
  quota_videos = COALESCE(quota_videos, 0),
  generations_this_month = COALESCE(generations_this_month, 0),
  quota_visuals_per_month = COALESCE(quota_visuals_per_month, 0);

UPDATE public.brands
SET 
  woofs_used = COALESCE(woofs_used, 0),
  quota_woofs = COALESCE(quota_woofs, 0),
  images_used = COALESCE(images_used, 0),
  quota_images = COALESCE(quota_images, 0),
  videos_used = COALESCE(videos_used, 0),
  quota_videos = COALESCE(quota_videos, 0);