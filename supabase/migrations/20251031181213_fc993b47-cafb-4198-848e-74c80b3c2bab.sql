-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Créer le trigger pour créer automatiquement un profil avec affilié
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_with_affiliate();

-- Créer les profils manquants pour les utilisateurs existants
INSERT INTO public.profiles (id, email, full_name, plan, quota_videos, quota_visuals_per_month, woofs_consumed_this_month, generations_this_month)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  'starter',  -- Plan par défaut
  15,         -- Quota videos starter
  150,        -- Quota visuels starter
  0,          -- Woofs consommés
  0           -- Générations ce mois
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Créer les affiliés manquants pour les utilisateurs existants
INSERT INTO public.affiliates (id, email, name, status)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'active'
FROM auth.users au
LEFT JOIN public.affiliates a ON a.id = au.id
WHERE a.id IS NULL
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name;