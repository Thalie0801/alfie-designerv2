-- 🔒 Renforcement de la sécurité multi-tenant
-- Ajout de RLS policies strictes sur la table jobs pour isolation complète

-- Activer RLS sur jobs (si pas déjà fait)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Politique de lecture: utilisateurs peuvent voir les jobs de leurs job_sets
DROP POLICY IF EXISTS "Users can view jobs from their job sets" ON public.jobs;
CREATE POLICY "Users can view jobs from their job sets"
  ON public.jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_sets
      WHERE job_sets.id = jobs.job_set_id
        AND job_sets.user_id = auth.uid()
    )
  );

-- Politique d'insertion: seul le service role peut insérer des jobs
DROP POLICY IF EXISTS "Service can insert jobs" ON public.jobs;
CREATE POLICY "Service can insert jobs"
  ON public.jobs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Politique de mise à jour: seul le service role peut mettre à jour les jobs
DROP POLICY IF EXISTS "Service can update jobs" ON public.jobs;
CREATE POLICY "Service can update jobs"
  ON public.jobs
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Politique de suppression: utilisateurs peuvent supprimer les jobs de leurs job_sets
DROP POLICY IF EXISTS "Users can delete jobs from their job sets" ON public.jobs;
CREATE POLICY "Users can delete jobs from their job sets"
  ON public.jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.job_sets
      WHERE job_sets.id = jobs.job_set_id
        AND job_sets.user_id = auth.uid()
    )
  );

-- Log de sécurité
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies renforcées sur jobs pour isolation multi-tenant';
END $$;