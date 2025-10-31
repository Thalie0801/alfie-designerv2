-- Fonction pour synchroniser automatiquement les quotas depuis plans_config
CREATE OR REPLACE FUNCTION sync_plan_quotas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_quotas RECORD;
BEGIN
  -- Si le plan a changé
  IF NEW.plan IS DISTINCT FROM OLD.plan AND NEW.plan IS NOT NULL THEN
    -- Récupérer les quotas du plan depuis plans_config
    SELECT woofs_per_month, visuals_per_month
    INTO plan_quotas
    FROM plans_config
    WHERE plan = NEW.plan;
    
    -- Mettre à jour les quotas du profil
    IF FOUND THEN
      NEW.quota_videos := plan_quotas.woofs_per_month;
      NEW.quota_visuals_per_month := plan_quotas.visuals_per_month;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pour appliquer automatiquement les quotas quand le plan change
CREATE TRIGGER on_profile_plan_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.plan IS DISTINCT FROM OLD.plan)
  EXECUTE FUNCTION sync_plan_quotas();

-- Backfill : appliquer rétroactivement les bons quotas à tous les profils existants
UPDATE profiles p
SET 
  quota_videos = pc.woofs_per_month,
  quota_visuals_per_month = pc.visuals_per_month
FROM plans_config pc
WHERE p.plan = pc.plan
  AND p.plan IS NOT NULL
  AND (p.quota_videos = 0 OR p.quota_visuals_per_month = 0);