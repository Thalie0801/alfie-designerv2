-- Phase 1: Créer la fonction increment_profile_visuals manquante
CREATE OR REPLACE FUNCTION increment_profile_visuals(
  p_profile_id UUID,
  p_delta INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET 
    generations_this_month = generations_this_month + p_delta,
    updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

-- Phase 2: Créer un trigger pour synchroniser brands.plan avec profiles.plan
CREATE OR REPLACE FUNCTION sync_brand_plan_with_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quand on met à jour le plan d'un profil, synchroniser avec toutes ses marques
  UPDATE brands
  SET plan = NEW.plan
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_brand_plan ON profiles;
CREATE TRIGGER trigger_sync_brand_plan
  AFTER UPDATE OF plan ON profiles
  FOR EACH ROW
  WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
  EXECUTE FUNCTION sync_brand_plan_with_profile();

-- Phase 2: Backfill - Synchroniser les plans existants des profils vers leurs marques
UPDATE brands b
SET plan = p.plan
FROM profiles p
WHERE b.user_id = p.id 
  AND p.plan IS NOT NULL
  AND (b.plan IS NULL OR b.plan != p.plan);

-- Phase 4: Cleanup - Mettre à jour les quotas de la marque "LR" de Sandrine selon son plan Pro
UPDATE brands b
SET 
  quota_images = pc.visuals_per_month,
  quota_videos = 999,  -- Illimité pour Pro
  quota_woofs = pc.woofs_per_month
FROM profiles p
JOIN plans_config pc ON pc.plan = p.plan AND pc.durations = 'monthly'
WHERE b.user_id = p.id
  AND b.name = 'LR'
  AND p.plan = 'pro'
  AND (b.quota_images = 0 OR b.quota_woofs = 0);