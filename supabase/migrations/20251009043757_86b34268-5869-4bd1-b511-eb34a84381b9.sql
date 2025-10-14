-- Ajouter la colonne quota_videos à la table profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS quota_videos integer DEFAULT 0;

-- Mettre à jour les profils existants avec les quotas vidéos selon leur plan
UPDATE profiles 
SET quota_videos = CASE 
  WHEN plan = 'starter' THEN 15
  WHEN plan = 'pro' THEN 45
  WHEN plan = 'studio' THEN 100
  WHEN plan = 'enterprise' THEN 9999
  ELSE 0
END
WHERE quota_videos = 0 OR quota_videos IS NULL;

-- Ajouter une colonne pour tracker les vidéos générées ce mois
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS videos_this_month integer DEFAULT 0;

-- Ajouter une colonne pour tracker les Woofs consommés ce mois
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS woofs_consumed_this_month integer DEFAULT 0;

COMMENT ON COLUMN profiles.quota_videos IS 'Quota mensuel de vidéos (non reportable)';
COMMENT ON COLUMN profiles.videos_this_month IS 'Nombre de vidéos générées ce mois';
COMMENT ON COLUMN profiles.woofs_consumed_this_month IS 'Nombre de Woofs consommés ce mois (Sora=1, Veo3=4)';