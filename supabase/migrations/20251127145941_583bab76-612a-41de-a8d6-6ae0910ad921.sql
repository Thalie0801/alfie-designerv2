-- Créer l'utilisateur admin
DO $$
DECLARE
  admin_user_id uuid;
  temp_password text := 'AdminTemp2024!';
BEGIN
  -- Créer l'utilisateur dans auth.users via la fonction admin
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'nathaliestaelens@gmail.com',
    crypt(temp_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO admin_user_id;

  -- Créer le profil
  INSERT INTO public.profiles (id, email, full_name, plan, status)
  VALUES (admin_user_id, 'nathaliestaelens@gmail.com', 'Admin', 'studio', 'active');

  -- Assigner le rôle admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin');

  RAISE NOTICE 'Admin user created with ID: %', admin_user_id;
END $$;