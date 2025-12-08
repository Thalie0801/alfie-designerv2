-- Table pour rate limiting du password reset
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_password_reset_email_time ON public.password_reset_requests(email, created_at DESC);

-- Auto-nettoyage après 24h
CREATE OR REPLACE FUNCTION public.cleanup_old_password_reset_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_requests
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Pas de RLS nécessaire (table interne utilisée uniquement par edge function avec service role)