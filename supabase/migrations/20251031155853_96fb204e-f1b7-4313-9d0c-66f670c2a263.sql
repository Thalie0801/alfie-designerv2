-- Assurer que alfie_requests_this_month a DEFAULT 0 (jamais NULL)
ALTER TABLE public.profiles
  ALTER COLUMN alfie_requests_this_month SET DEFAULT 0;

-- Mettre à jour les valeurs NULL existantes
UPDATE public.profiles
SET alfie_requests_this_month = COALESCE(alfie_requests_this_month, 0);