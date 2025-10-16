-- Assign Studio plan to admin user and ensure active subscription window
DO $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'nathaliestaelens@gmail.com';

  IF NOT FOUND THEN
    RAISE NOTICE 'Admin user with email % not found, skipping Studio plan assignment.',
      'nathaliestaelens@gmail.com';
    RETURN;
  END IF;

  SELECT id INTO v_plan_id
  FROM plans
  WHERE slug = 'studio';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Studio plan (slug=studio) not found. Ensure subscription plans are seeded before running this migration.';
  END IF;

  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  )
  VALUES (
    v_user_id,
    v_plan_id,
    'active',
    NOW(),
    NOW() + INTERVAL '1 month',
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = NOW();
END;
$$;
