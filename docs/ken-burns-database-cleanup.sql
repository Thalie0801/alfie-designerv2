-- ============================================================
-- Ken Burns Video Database Cleanup
-- ============================================================
-- Ce script nettoie les anciennes vidéos Ken Burns corrompues
-- qui ont des URLs invalides dans media_generations.
--
-- À exécuter dans la console Supabase SQL Editor après le
-- déploiement des nouvelles Edge Functions.
-- ============================================================

-- 1️⃣ Supprimer les vidéos avec .mp4 dans le public_id (ancien bug)
DELETE FROM media_generations 
WHERE type = 'video' 
AND metadata->>'animationType' = 'ken_burns'
AND output_url LIKE '%.mp4.mp4%';

-- Résultat attendu: 0-5 lignes supprimées (anciennes entrées corrompues)

-- 2️⃣ Supprimer les vidéos avec output_url ne commençant pas par https://
DELETE FROM media_generations 
WHERE type = 'video' 
AND output_url NOT LIKE 'https://%';

-- Résultat attendu: 0-10 lignes supprimées (URLs relatives ou base64)

-- 3️⃣ Vérification: Lister les vidéos Ken Burns restantes
SELECT 
  id,
  LEFT(output_url, 100) AS url_preview,
  metadata->>'animationType' AS anim_type,
  created_at
FROM media_generations
WHERE type = 'video'
AND metadata->>'animationType' = 'ken_burns'
ORDER BY created_at DESC
LIMIT 10;

-- ⚠️ IMPORTANT: Toutes les URLs doivent maintenant commencer par:
-- https://res.cloudinary.com/[cloud_name]/video/upload/...
-- 
-- Aucune URL ne doit contenir "animated_base_" directement dans le chemin vidéo
