-- Phase 1: Migration SQL - Colonnes, contraintes, index

-- 1. Ajouter index_in_set en colonne réelle sur jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS index_in_set INT;

-- 2. Contrainte d'unicité pour éviter doublons dans un job_set
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_unique_in_set'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_unique_in_set UNIQUE (job_set_id, index_in_set);
  END IF;
END $$;

-- 3. Ajouter index_in_set en colonne réelle sur assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS index_in_set INT;

-- 4. Index composite pour optimiser les requêtes Realtime
CREATE INDEX IF NOT EXISTS idx_assets_jobset 
  ON public.assets(job_set_id, index_in_set, created_at);

-- 5. Migration des données existantes (copier meta.index_in_set → colonne)
UPDATE public.assets 
SET index_in_set = CAST(meta->>'index_in_set' AS INT)
WHERE meta->>'index_in_set' IS NOT NULL 
  AND index_in_set IS NULL;