-- Phase 1: Migration DB pour nouveau pipeline carrousel

-- Ajouter colonnes aux jobs pour templates et retries
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS slide_template TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coherence_threshold INT DEFAULT 75;

-- Ajouter colonne style_ref_url aux job_sets
ALTER TABLE job_sets
  ADD COLUMN IF NOT EXISTS style_ref_url TEXT;

COMMENT ON COLUMN jobs.slide_template IS 'Type de slide: hero, problem, solution, impact, cta';
COMMENT ON COLUMN jobs.retry_count IS 'Nombre de tentatives de génération (max 3)';
COMMENT ON COLUMN jobs.coherence_threshold IS 'Score minimum de cohérence requis (0-100)';
COMMENT ON COLUMN job_sets.style_ref_url IS 'URL de la key visual pour comparaison de style';