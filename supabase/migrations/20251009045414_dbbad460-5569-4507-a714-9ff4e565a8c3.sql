-- Créer une table pour les logs de génération (conformité RGPD - logs sobres)
CREATE TABLE IF NOT EXISTS public.generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  engine text CHECK (engine IN ('nano', 'sora', 'veo3')),
  prompt_summary text, -- Prompt tronqué (max 100 chars)
  woofs_cost integer DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'expired')),
  duration_seconds integer, -- Durée de génération (analytics)
  error_code text, -- Code d'erreur si échec
  metadata jsonb DEFAULT '{}'::jsonb -- Données additionnelles minimales
);

-- Index pour requêtes de logs
CREATE INDEX IF NOT EXISTS idx_generation_logs_brand_created 
ON public.generation_logs(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_logs_user_created 
ON public.generation_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_logs_type_engine 
ON public.generation_logs(type, engine)
WHERE status = 'success';

-- RLS pour les logs
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view own generation logs"
ON public.generation_logs
FOR SELECT
USING (user_id = auth.uid());

-- Seuls les admins peuvent voir tous les logs
CREATE POLICY "Admins can view all generation logs"
ON public.generation_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Seul le système (service_role) peut insérer des logs
CREATE POLICY "Service role can insert generation logs"
ON public.generation_logs
FOR INSERT
WITH CHECK (true);

-- Trigger pour purger les vieux logs (30 jours)
CREATE OR REPLACE FUNCTION public.purge_old_generation_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.generation_logs
  WHERE created_at < (now() - interval '30 days');
  RETURN NEW;
END;
$$;

CREATE TRIGGER purge_old_logs_trigger
AFTER INSERT ON public.generation_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.purge_old_generation_logs();

-- Commentaires
COMMENT ON TABLE public.generation_logs IS 'Logs sobres de génération (RGPD compliant, purge 30j)';
COMMENT ON COLUMN public.generation_logs.prompt_summary IS 'Résumé du prompt (max 100 chars, RGPD)';
COMMENT ON COLUMN public.generation_logs.woofs_cost IS 'Coût en Woofs (0 pour images, 1 pour Sora, 4 pour Veo3)';
COMMENT ON COLUMN public.generation_logs.metadata IS 'Données minimales additionnelles (analytics)';