-- Ensure free plans without whitelist lose access
WITH admin_ids AS (
  SELECT user_id
  FROM public.user_roles
  WHERE role = 'admin'
)
UPDATE public.profiles p
SET status = 'pending'
WHERE p.status = 'active'
  AND (p.plan IS NULL OR lower(p.plan) = 'free')
  AND COALESCE(p.granted_by_admin, false) = false
  AND p.id NOT IN (SELECT user_id FROM admin_ids);

-- Harden access control helper to require paid plan or active subscription
CREATE OR REPLACE FUNCTION public.user_has_access(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
  has_subscription boolean;
BEGIN
  -- Admins always have access
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_id_param AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  SELECT plan, granted_by_admin, status
  INTO profile_record
  FROM public.profiles
  WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF profile_record.granted_by_admin THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = user_id_param
      AND lower(us.status) IN ('active', 'trialing', 'trial')
      AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
  )
  INTO has_subscription;

  IF has_subscription THEN
    RETURN true;
  END IF;

  IF profile_record.status = 'active'
     AND lower(COALESCE(profile_record.plan, '')) IN ('starter', 'pro', 'studio', 'enterprise') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Helper to clean up inactive profiles (used by scheduled job)
CREATE OR REPLACE FUNCTION public.purge_inactive_profiles()
RETURNS TABLE (profile_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH target_profiles AS (
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE COALESCE(p.granted_by_admin, false) = false
      AND (
        p.status IS NULL
        OR p.status <> 'active'
        OR lower(COALESCE(p.plan, '')) = 'free'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = p.id AND ur.role = 'admin'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_subscriptions us
        WHERE us.user_id = p.id
          AND lower(us.status) IN ('active', 'trialing', 'trial')
          AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
      )
  ), updated_profiles AS (
    UPDATE public.profiles p
    SET plan = 'free',
        status = 'pending',
        stripe_subscription_id = NULL,
        stripe_customer_id = NULL,
        updated_at = NOW()
    WHERE p.id IN (SELECT id FROM target_profiles)
    RETURNING p.id
  ), inactive_affiliates AS (
    UPDATE public.affiliates a
    SET status = 'inactive'
    WHERE a.id IN (SELECT id FROM target_profiles)
    RETURNING a.id
  )
  SELECT tp.id, tp.email
  FROM target_profiles tp;
END;
$$;
