-- Migration : Ajouter colonne is_default à la table brands
-- Cette colonne permet de marquer une marque par défaut par utilisateur

-- 1. Ajouter la colonne is_default
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 2. Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_brands_user_default ON brands(user_id, is_default) WHERE is_default = true;

-- 3. Définir la première marque de chaque utilisateur comme marque par défaut
UPDATE brands b1
SET is_default = true
WHERE id = (
  SELECT id FROM brands b2
  WHERE b2.user_id = b1.user_id
  ORDER BY created_at ASC
  LIMIT 1
)
AND is_default = false;

-- 4. Ajouter un commentaire sur la colonne
COMMENT ON COLUMN brands.is_default IS 'Marque par défaut de l''utilisateur (une seule par user_id)';