-- Corriger les quotas du profil utilisateur pour le plan studio
-- D'abord, récupérer les valeurs du plan studio depuis plans_config
UPDATE profiles
SET 
  quota_brands = COALESCE((SELECT 1), 1), -- Au moins 1 marque gratuite
  quota_visuals_per_month = COALESCE((SELECT visuals_per_month FROM plans_config WHERE plan = 'studio' LIMIT 1), 100),
  quota_videos = COALESCE((SELECT visuals_per_month FROM plans_config WHERE plan = 'studio' LIMIT 1), 100)
WHERE plan = 'studio' AND (quota_brands IS NULL OR quota_brands = 0);

-- S'assurer que tous les utilisateurs ont au moins 1 marque gratuite
UPDATE profiles
SET quota_brands = 1
WHERE quota_brands IS NULL OR quota_brands = 0;