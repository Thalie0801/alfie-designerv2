-- Ensure profiles have explicit access control status fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Default plan should be free for new signups until activation
ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'free';

-- Backfill new defaults where missing
UPDATE public.profiles
SET plan = 'free'
WHERE plan IS NULL;

UPDATE public.profiles
SET status = 'pending'
WHERE status IS NULL;

UPDATE public.profiles
SET email_verified = COALESCE(email_verified, false);

-- Recreate the signup trigger helper to enforce the new defaults
CREATE OR REPLACE FUNCTION public.handle_new_user_with_affiliate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, status, email_verified, granted_by_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'free',
    'pending',
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    email_verified = EXCLUDED.email_verified,
    granted_by_admin = EXCLUDED.granted_by_admin,
    updated_at = NOW();

  INSERT INTO public.affiliates (id, email, name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the trigger calls the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_with_affiliate();

-- Guarantee admin privileges and access for Nathalie
WITH admin_user AS (
  SELECT id FROM auth.users WHERE email = 'nathaliestaelens@gmail.com'
)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM admin_user
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET plan = 'studio',
    status = 'active',
    granted_by_admin = true
WHERE email = 'nathaliestaelens@gmail.com';

-- Preserve studio access for Patricia and Sandrine
UPDATE public.profiles
SET plan = 'studio',
    status = 'active'
WHERE email IN ('borderonpatricia7@gmail.com', 'Sandrine.guedra@gmail.com');

-- Reset non-whitelisted users without active subscriptions to free/pending
WITH active_sub AS (
  SELECT user_id
  FROM public.user_subscriptions
  WHERE status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW())
)
UPDATE public.profiles p
SET plan = 'free',
    status = 'pending'
WHERE (p.granted_by_admin IS NULL OR p.granted_by_admin = false)
  AND p.id NOT IN (SELECT user_id FROM active_sub)
  AND p.email NOT IN ('borderonpatricia7@gmail.com', 'Sandrine.guedra@gmail.com')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  );

-- Updated access check to honour admin role, whitelist and status
CREATE OR REPLACE FUNCTION public.user_has_access(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
BEGIN
  -- Admins are always authorized
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

  RETURN profile_record.status = 'active';
END;
$$;
