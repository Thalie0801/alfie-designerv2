-- 1. Corriger immédiatement les quotas de la brand de Patricia
UPDATE brands 
SET 
  quota_woofs = 450,
  quota_images = 450,
  quota_videos = 450,
  plan = 'pro'
WHERE id = '8af3b633-6e99-4f6b-84c6-306904158feb';

-- 2. Améliorer le trigger pour synchroniser plan ET quotas automatiquement
CREATE OR REPLACE FUNCTION public.sync_brand_plan_with_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_quotas RECORD;
BEGIN
  -- Ne rien faire si le plan n'a pas changé
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan THEN
    RETURN NEW;
  END IF;

  -- Récupérer les quotas du nouveau plan
  SELECT woofs_per_month, visuals_per_month 
  INTO plan_quotas
  FROM plans_config
  WHERE plan = NEW.plan;
  
  -- Synchroniser plan ET quotas sur toutes les brands de l'utilisateur
  UPDATE brands
  SET 
    plan = NEW.plan,
    quota_woofs = COALESCE(plan_quotas.woofs_per_month, 0),
    quota_images = COALESCE(plan_quotas.visuals_per_month, 0),
    quota_videos = COALESCE(plan_quotas.woofs_per_month, 0)
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$function$;