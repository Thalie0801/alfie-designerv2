-- ============================================================
-- Nettoyage des assets Cloudinary avec URLs 404
-- ============================================================
-- À exécuter dans la console Supabase SQL Editor après le
-- déploiement des correctifs backend.
-- ============================================================

-- 1️⃣ Identifier les images avec URLs potentiellement cassées
-- (patterns image_1.png, image_2.png qui ne sont pas des URLs complètes)
SELECT 
  id,
  LEFT(output_url, 120) AS url_preview,
  status,
  created_at,
  metadata->>'orderId' AS order_id
FROM media_generations
WHERE type = 'image'
  AND (
    output_url LIKE '%/image_%.png'
    OR output_url LIKE '%/img_%.png'
  )
  AND created_at >= '2025-01-28'::timestamp
ORDER BY created_at DESC;

-- ❓ Si la requête ci-dessus retourne des résultats, les supprimer :
-- DELETE FROM media_generations 
-- WHERE type = 'image' 
--   AND (
--     output_url LIKE '%/image_%.png'
--     OR output_url LIKE '%/img_%.png'
--   )
--   AND created_at >= '2025-01-28'::timestamp;

-- 2️⃣ Identifier les vidéos avec thumbnail_url invalides
-- (animated_base_*.jpg sans domaine complet)
SELECT 
  id,
  LEFT(output_url, 80) AS video_url,
  LEFT(thumbnail_url, 80) AS thumb_url,
  thumbnail_url NOT LIKE 'https://res.cloudinary.com%' AS is_invalid,
  metadata->>'animationType' AS anim_type,
  created_at
FROM media_generations
WHERE type = 'video'
  AND (
    thumbnail_url IS NULL 
    OR thumbnail_url NOT LIKE 'https://res.cloudinary.com%'
  )
ORDER BY created_at DESC
LIMIT 20;

-- ❓ Si ces vidéos ont des URLs output_url valides, on peut NULL leur thumbnail :
-- UPDATE media_generations
-- SET thumbnail_url = NULL
-- WHERE type = 'video'
--   AND thumbnail_url IS NOT NULL
--   AND thumbnail_url NOT LIKE 'https://res.cloudinary.com%';

-- 3️⃣ Vérifier les vidéos avec output_url invalides (relatifs)
SELECT 
  id,
  output_url,
  thumbnail_url,
  status,
  created_at
FROM media_generations
WHERE type = 'video'
  AND output_url NOT LIKE 'https://%'
ORDER BY created_at DESC
LIMIT 20;

-- ❓ Supprimer les vidéos avec output_url complètement invalides :
-- DELETE FROM media_generations 
-- WHERE type = 'video' 
--   AND output_url NOT LIKE 'https://%'
--   AND created_at >= '2025-01-28'::timestamp;

-- 4️⃣ Statistiques finales après nettoyage
SELECT 
  type,
  COUNT(*) AS total,
  COUNT(CASE WHEN output_url LIKE 'https://res.cloudinary.com%' THEN 1 END) AS valid_urls,
  COUNT(CASE WHEN output_url NOT LIKE 'https://%' THEN 1 END) AS invalid_urls
FROM media_generations
WHERE created_at >= '2025-01-28'::timestamp
GROUP BY type;

-- ⚠️ IMPORTANT: Exécuter les DELETE uniquement après avoir vérifié les SELECT !
-- Les requêtes commentées (--) doivent être décommentées manuellement.
