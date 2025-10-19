-- Ensure Nathalie Staelens test account has Studio plan and subscription
DO $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'nathaliestaelens@gmail.com';

  IF NOT FOUND THEN
    RAISE NOTICE 'User with email % not found, skipping Studio activation.', 'nathaliestaelens@gmail.com';
    RETURN;
  END IF;

  -- Update profile quotas and plan
  UPDATE profiles
  SET
    plan = 'studio',
    quota_brands = GREATEST(COALESCE(quota_brands, 0), 1),
    quota_visuals_per_month = GREATEST(COALESCE(quota_visuals_per_month, 0), 1000),
    quota_videos = GREATEST(COALESCE(quota_videos, 0), 100),
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Ensure there is an active Studio subscription record
  SELECT id INTO v_plan_id
  FROM plans
  WHERE slug = 'studio';

  IF NOT FOUND THEN
    RAISE NOTICE 'Studio plan not found, skipping subscription activation.';
  ELSE
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
  END IF;
END;
$$;
