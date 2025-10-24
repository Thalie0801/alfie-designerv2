-- Créer le profil Studio pour Sandrine (si elle n'existe pas)
INSERT INTO public.profiles (id, email, full_name, plan, quota_brands, quota_visuals_per_month, quota_videos, ai_credits_monthly)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'Sandrine.guedra@gmail.com' LIMIT 1),
  'Sandrine.guedra@gmail.com',
  'Sandrine Guedra',
  'studio',
  10,
  1000,
  100,
  10000
WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'Sandrine.guedra@gmail.com')
ON CONFLICT (id) DO UPDATE SET
  plan = 'studio',
  quota_brands = 10,
  quota_visuals_per_month = 1000,
  quota_videos = 100,
  ai_credits_monthly = 10000;

-- Mettre à jour le profil de Patricia avec le plan Studio
UPDATE public.profiles
SET 
  plan = 'studio',
  quota_brands = 10,
  quota_visuals_per_month = 1000,
  quota_videos = 100,
  ai_credits_monthly = 10000
WHERE email = 'borderonpatricia7@gmail.com';

-- Créer une marque par défaut pour Sandrine si elle n'en a pas
INSERT INTO public.brands (user_id, name, plan, quota_images, quota_videos, quota_woofs)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'Sandrine.guedra@gmail.com' LIMIT 1),
  'Ma Marque',
  'studio',
  1000,
  100,
  100
WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'Sandrine.guedra@gmail.com')
AND NOT EXISTS (
  SELECT 1 FROM brands WHERE user_id = (SELECT id FROM auth.users WHERE email = 'Sandrine.guedra@gmail.com' LIMIT 1)
);

-- Mettre à jour la marque existante de Patricia "Astuces Eco" avec le plan Studio
UPDATE public.brands
SET 
  plan = 'studio',
  quota_images = 1000,
  quota_videos = 100,
  quota_woofs = 100
WHERE user_id = (SELECT id FROM profiles WHERE email = 'borderonpatricia7@gmail.com')
AND name = 'Astuces Eco';

-- Définir la marque active pour Sandrine et Patricia si ce n'est pas déjà fait
UPDATE public.profiles p
SET active_brand_id = (
  SELECT b.id 
  FROM brands b 
  WHERE b.user_id = p.id 
  ORDER BY b.created_at ASC 
  LIMIT 1
)
WHERE p.email IN ('borderonpatricia7@gmail.com', 'Sandrine.guedra@gmail.com')
AND p.active_brand_id IS NULL;