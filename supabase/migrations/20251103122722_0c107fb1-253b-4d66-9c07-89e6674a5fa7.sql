-- Nettoyer les palettes de couleurs invalides (noms de couleurs au lieu de codes hex)
-- Remplacer par une palette par défaut moderne en cas de format invalide
UPDATE brands
SET palette = '["#1a1a1a", "#ffffff", "#3b82f6"]'::jsonb
WHERE palette::text ~ '[a-zA-Z]' 
  AND palette::text !~ '#[0-9A-Fa-f]{6}';