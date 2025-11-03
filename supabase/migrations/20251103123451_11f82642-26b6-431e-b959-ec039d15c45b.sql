-- Normaliser les palettes contenant des objets {color: "#..."} en tableau de chaînes hex
UPDATE brands
SET palette = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(elem) = 'object' THEN COALESCE(elem->>'color', '#000000')
      WHEN jsonb_typeof(elem) = 'string' THEN elem::text
      ELSE '"#000000"'
    END::text
  )
  FROM jsonb_array_elements(palette) AS elem
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(palette) AS e 
  WHERE jsonb_typeof(e) = 'object'
);