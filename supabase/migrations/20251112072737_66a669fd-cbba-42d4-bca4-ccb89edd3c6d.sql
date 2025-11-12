-- Corriger les 2 fonctions restantes sans SET search_path
-- user_has_access
CREATE OR REPLACE FUNCTION public.user_has_access(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  SELECT plan, stripe_subscription_id, granted_by_admin
  INTO profile_record
  FROM profiles
  WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN (
    (profile_record.plan IS NOT NULL AND profile_record.plan != 'none' AND profile_record.stripe_subscription_id IS NOT NULL)
    OR profile_record.granted_by_admin = true
  );
END;
$function$;

-- increment_alfie_requests
CREATE OR REPLACE FUNCTION public.increment_alfie_requests(user_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_count INTEGER;
  reset_date TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT alfie_requests_this_month, alfie_requests_reset_date 
  INTO current_count, reset_date
  FROM profiles
  WHERE id = user_id_param;
  
  IF reset_date < now() THEN
    UPDATE profiles
    SET 
      alfie_requests_this_month = 1,
      alfie_requests_reset_date = date_trunc('month', now() + interval '1 month')
    WHERE id = user_id_param;
    RETURN 1;
  END IF;
  
  UPDATE profiles
  SET alfie_requests_this_month = alfie_requests_this_month + 1
  WHERE id = user_id_param;
  
  RETURN current_count + 1;
END;
$function$;