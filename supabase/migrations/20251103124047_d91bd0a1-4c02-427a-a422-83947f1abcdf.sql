-- Normaliser définitivement toutes les palettes : supprimer guillemets/backslashes et forcer #RRGGBB
UPDATE brands
SET palette = (
  SELECT jsonb_agg(
    to_jsonb(
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN 
          CASE
            WHEN COALESCE(elem->>'color', '') ~ '^#[0-9A-Fa-f]{6}$' THEN COALESCE(elem->>'color', '#000000')
            WHEN COALESCE(elem->>'color', '') ~ '^[0-9A-Fa-f]{6}$' THEN '#' || COALESCE(elem->>'color', '000000')
            ELSE '#000000'
          END
        WHEN jsonb_typeof(elem) = 'string' THEN
          CASE
            WHEN regexp_replace(replace(replace(elem::text, '"', ''), '\\', ''), '\s', '', 'g') ~ '^#[0-9A-Fa-f]{6}$' 
              THEN regexp_replace(replace(replace(elem::text, '"', ''), '\\', ''), '\s', '', 'g')
            WHEN regexp_replace(replace(replace(elem::text, '"', ''), '\\', ''), '\s', '', 'g') ~ '^[0-9A-Fa-f]{6}$' 
              THEN '#' || regexp_replace(replace(replace(elem::text, '"', ''), '\\', ''), '\s', '', 'g')
            ELSE '#000000'
          END
        ELSE '#000000'
      END
    )
  )
  FROM jsonb_array_elements(palette) AS elem
)
WHERE palette IS NOT NULL;