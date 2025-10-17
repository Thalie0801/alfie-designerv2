-- Vérifier que le trigger pour créer les profils existe
-- S'il existe déjà, on le recrée pour être sûr qu'il fonctionne

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Créer le trigger qui crée automatiquement un profil et un compte affilié
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_with_affiliate();

-- S'assurer que les profils peuvent être créés automatiquement
DROP POLICY IF EXISTS "Enable insert for service role" ON public.profiles;
CREATE POLICY "Enable insert for service role" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

-- S'assurer que les affiliés peuvent être créés automatiquement  
DROP POLICY IF EXISTS "Enable insert for service role on affiliates" ON public.affiliates;
CREATE POLICY "Enable insert for service role on affiliates"
ON public.affiliates
FOR INSERT
WITH CHECK (true);