-- Supprimer l'entrée affilié orpheline pour Sandrine
DELETE FROM affiliates WHERE email = 'sandrine.guedra54@gmail.com' AND id NOT IN (SELECT id FROM auth.users);

-- Créer le compte auth pour Sandrine
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Chercher si l'utilisateur existe déjà
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'sandrine.guedra54@gmail.com';
  
  -- Si pas trouvé, créer le compte auth
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_current,
      email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'sandrine.guedra54@gmail.com',
      crypt('Sgu54700!', gen_salt('bf')),
      now(),
      '{"full_name": "Sandrine Guedra"}'::jsonb,
      now(),
      now(),
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;
  END IF;
  
  -- Créer ou mettre à jour le profil
  INSERT INTO profiles (id, email, full_name, plan, granted_by_admin)
  VALUES (
    v_user_id,
    'sandrine.guedra54@gmail.com',
    'Sandrine Guedra',
    'pro',
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    plan = EXCLUDED.plan,
    granted_by_admin = EXCLUDED.granted_by_admin,
    updated_at = now();
END $$;