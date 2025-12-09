-- Sécuriser la table password_reset_requests (données sensibles: emails, IPs)
-- Seul le service_role peut accéder à cette table

-- Activer RLS sur la table
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Politique: aucun accès public (seul service_role via Edge Functions)
CREATE POLICY "No public access - service role only"
ON public.password_reset_requests
FOR ALL
USING (false)
WITH CHECK (false);