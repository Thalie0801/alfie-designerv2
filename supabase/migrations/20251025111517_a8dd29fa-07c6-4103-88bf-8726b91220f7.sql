-- Ajouter le champ granted_by_admin aux profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS granted_by_admin BOOLEAN DEFAULT false;

-- Fonction pour vérifier si un utilisateur a accès (Stripe OU granted_by_admin)
CREATE OR REPLACE FUNCTION public.user_has_access(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
BEGIN
  -- Récupérer le profil
  SELECT plan, stripe_subscription_id, granted_by_admin
  INTO profile_record
  FROM profiles
  WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Accès accordé si :
  -- 1. Abonnement Stripe actif (plan non null et stripe_subscription_id présent)
  -- OU 2. Accès manuel (granted_by_admin = true)
  RETURN (
    (profile_record.plan IS NOT NULL AND profile_record.plan != 'none' AND profile_record.stripe_subscription_id IS NOT NULL)
    OR profile_record.granted_by_admin = true
  );
END;
$$;

-- Créer une table pour les jobs de génération vidéo/image
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image_gen', 'video_gen')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  request_id text UNIQUE,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own jobs (but only if they have access)
CREATE POLICY "Authorized users can create jobs"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  user_has_access(auth.uid())
);

-- Service can update jobs
CREATE POLICY "Service can update jobs"
ON public.jobs
FOR UPDATE
TO authenticated
USING (true);

-- Commentaire: La fonction user_has_access() vérifie l'accès via Stripe OU granted_by_admin