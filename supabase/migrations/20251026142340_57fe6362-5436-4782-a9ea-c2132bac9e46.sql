-- Étape 1A : Sécuriser les RLS policies sur profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Users peuvent seulement modifier leurs infos de base (nom, avatar)
CREATE POLICY "Users can update own basic info"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND plan IS NOT DISTINCT FROM (SELECT plan FROM profiles WHERE id = auth.uid())
  AND granted_by_admin IS NOT DISTINCT FROM (SELECT granted_by_admin FROM profiles WHERE id = auth.uid())
  AND quota_visuals_per_month IS NOT DISTINCT FROM (SELECT quota_visuals_per_month FROM profiles WHERE id = auth.uid())
  AND quota_brands IS NOT DISTINCT FROM (SELECT quota_brands FROM profiles WHERE id = auth.uid())
  AND quota_videos IS NOT DISTINCT FROM (SELECT quota_videos FROM profiles WHERE id = auth.uid())
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM profiles WHERE id = auth.uid())
  AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM profiles WHERE id = auth.uid())
);

-- Admins peuvent tout modifier
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Étape 1B : Créer/corriger les profils de Sandrine et Patricia avec quotas Plan Pro (450 visuels/mois, 45 vidéos, 5 woofs)
-- Seulement si les utilisateurs existent
INSERT INTO profiles (id, email, plan, granted_by_admin, quota_visuals_per_month, quota_brands, quota_videos)
SELECT 
  id, 
  email, 
  'pro',
  true,
  450,
  1,
  45
FROM auth.users 
WHERE email = 'Sandrine.guedra@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET 
  plan = 'pro', 
  granted_by_admin = true,
  quota_visuals_per_month = 450,
  quota_brands = 1,
  quota_videos = 45;

UPDATE profiles 
SET 
  plan = 'pro',
  granted_by_admin = true,
  quota_visuals_per_month = 450,
  quota_brands = 1,
  quota_videos = 45
WHERE email = 'borderonpatricia7@gmail.com';

-- Étape 1C : Gérer l'affiliation (nathaliestaelens@gmail.com comme parent)
DO $$
DECLARE
  nathalie_affiliate_id uuid;
  sandrine_user_id uuid;
  patricia_user_id uuid;
BEGIN
  SELECT id INTO nathalie_affiliate_id 
  FROM affiliates 
  WHERE email = 'nathaliestaelens@gmail.com';
  
  IF nathalie_affiliate_id IS NULL THEN
    INSERT INTO affiliates (id, email, name, status, affiliate_status)
    SELECT id, email, 'Nathalie Staelens', 'active', 'creator'
    FROM auth.users
    WHERE email = 'nathaliestaelens@gmail.com'
    RETURNING id INTO nathalie_affiliate_id;
  END IF;
  
  -- Récupérer les IDs utilisateur seulement s'ils existent
  SELECT id INTO sandrine_user_id FROM auth.users WHERE email = 'Sandrine.guedra@gmail.com';
  SELECT id INTO patricia_user_id FROM auth.users WHERE email = 'borderonpatricia7@gmail.com';
  
  -- Créer/mettre à jour Sandrine seulement si elle existe
  IF sandrine_user_id IS NOT NULL AND nathalie_affiliate_id IS NOT NULL THEN
    INSERT INTO affiliates (id, email, name, status, parent_id, affiliate_status)
    VALUES (sandrine_user_id, 'Sandrine.guedra@gmail.com', 'Sandrine Guedra', 'active', nathalie_affiliate_id, 'creator')
    ON CONFLICT (id) DO UPDATE 
    SET parent_id = nathalie_affiliate_id, status = 'active', affiliate_status = 'creator';
    
    INSERT INTO affiliate_conversions (affiliate_id, user_id, plan, amount, status)
    VALUES (nathalie_affiliate_id, sandrine_user_id, 'pro', 0, 'paid')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Mettre à jour Patricia seulement si elle existe
  IF patricia_user_id IS NOT NULL AND nathalie_affiliate_id IS NOT NULL THEN
    UPDATE affiliates
    SET parent_id = nathalie_affiliate_id, affiliate_status = 'creator'
    WHERE id = patricia_user_id;
    
    INSERT INTO affiliate_conversions (affiliate_id, user_id, plan, amount, status)
    VALUES (nathalie_affiliate_id, patricia_user_id, 'pro', 0, 'paid')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Mettre à jour le statut d'affilié de Nathalie
  IF nathalie_affiliate_id IS NOT NULL THEN
    PERFORM update_affiliate_status(nathalie_affiliate_id);
  END IF;
END $$;

-- Étape 1D : Créer les brands par défaut seulement pour les utilisateurs existants
INSERT INTO brands (id, user_id, name, plan, quota_images, quota_videos, quota_woofs)
SELECT 
  gen_random_uuid(), 
  id, 
  'Ma Marque', 
  'pro',
  450,
  45,
  5
FROM auth.users
WHERE email = 'Sandrine.guedra@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM brands WHERE user_id = auth.users.id
);

UPDATE profiles
SET active_brand_id = (
  SELECT id FROM brands WHERE user_id = profiles.id LIMIT 1
)
WHERE email IN ('Sandrine.guedra@gmail.com', 'borderonpatricia7@gmail.com')
AND active_brand_id IS NULL;