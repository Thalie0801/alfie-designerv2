-- ✅ Nettoyage des marques en surplus : garder uniquement la plus ancienne par utilisateur
-- Cette migration supprime les marques au-delà de la 1ère pour chaque user_id

DELETE FROM brands
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM brands
  ORDER BY user_id, created_at ASC
);

-- Ajouter un commentaire de confirmation
COMMENT ON TABLE brands IS 'Une seule marque par utilisateur (la plus ancienne est conservée)';
