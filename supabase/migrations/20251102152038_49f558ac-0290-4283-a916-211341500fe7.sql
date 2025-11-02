-- Synchroniser les quotas des brands VIP/Admin avec leurs plans configurés

-- Mettre à jour les brands des utilisateurs avec plan 'pro'
UPDATE brands b
SET 
  quota_images = pc.visuals_per_month,
  quota_woofs = pc.woofs_per_month,
  quota_videos = 0, -- Les vidéos utilisent les woofs
  images_used = 0,
  woofs_used = 0,
  videos_used = 0,
  resets_on = date_trunc('month', now() + interval '1 month')::date
FROM profiles p
JOIN plans_config pc ON pc.plan = p.plan
WHERE b.user_id = p.id
  AND p.plan = 'pro'
  AND (b.quota_images = 0 OR b.quota_woofs = 0);

-- Mettre à jour les brands des utilisateurs avec plan 'enterprise'
UPDATE brands b
SET 
  quota_images = pc.visuals_per_month,
  quota_woofs = pc.woofs_per_month,
  quota_videos = 0,
  images_used = 0,
  woofs_used = 0,
  videos_used = 0,
  resets_on = date_trunc('month', now() + interval '1 month')::date
FROM profiles p
JOIN plans_config pc ON pc.plan = p.plan
WHERE b.user_id = p.id
  AND p.plan = 'enterprise'
  AND (b.quota_images = 0 OR b.quota_woofs = 0);

-- Log pour vérification
DO $$
DECLARE
  sandrine_brands int;
  nathalie_brands int;
BEGIN
  SELECT COUNT(*) INTO sandrine_brands
  FROM brands b
  JOIN auth.users u ON u.id = b.user_id
  WHERE u.email = 'sandrine.guedra54@gmail.com'
    AND b.quota_images > 0;
  
  SELECT COUNT(*) INTO nathalie_brands
  FROM brands b
  JOIN auth.users u ON u.id = b.user_id
  WHERE u.email = 'nathaliestaelens@gmail.com'
    AND b.quota_images > 0;
  
  RAISE NOTICE 'Brands mises à jour : Sandrine (%), Nathalie (%)', sandrine_brands, nathalie_brands;
END $$;