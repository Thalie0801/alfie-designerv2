-- Corriger le trigger pour gérer les doublons d'email dans affiliates
CREATE OR REPLACE FUNCTION public.handle_new_user_with_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Créer le profil
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  -- Créer automatiquement un compte affilié (ou mettre à jour l'ID si l'email existe déjà)
  INSERT INTO public.affiliates (id, email, name, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'active'
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name;

  RETURN new;
END;
$function$;