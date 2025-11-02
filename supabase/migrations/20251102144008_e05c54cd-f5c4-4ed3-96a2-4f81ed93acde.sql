-- Ajouter le champ niche à la table brands
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS niche TEXT;

COMMENT ON COLUMN brands.niche IS 'Secteur/niche de la marque (ex: tech, fashion, food)';