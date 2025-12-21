-- Ajouter colonnes d'apprentissage à alfie_memory
ALTER TABLE alfie_memory 
ADD COLUMN IF NOT EXISTS custom_terms jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS learned_shortcuts jsonb DEFAULT '{}';