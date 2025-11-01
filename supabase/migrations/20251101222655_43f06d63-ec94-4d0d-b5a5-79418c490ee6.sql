-- Migration: Multi-tenant isolation avec brand_id strict

-- 1. Backfill media_generations.brand_id depuis profiles.active_brand_id
UPDATE media_generations mg
SET brand_id = p.active_brand_id
FROM profiles p
WHERE mg.user_id = p.id
  AND mg.brand_id IS NULL
  AND p.active_brand_id IS NOT NULL;

-- 2. Rendre brand_id obligatoire sur media_generations
ALTER TABLE media_generations 
ALTER COLUMN brand_id SET NOT NULL;

-- 3. RLS stricte sur media_generations
DROP POLICY IF EXISTS "Users can view their own media generations" ON media_generations;
DROP POLICY IF EXISTS "Users can create their own media generations" ON media_generations;
DROP POLICY IF EXISTS "Users can update their own media generations" ON media_generations;
DROP POLICY IF EXISTS "Users can delete their own media generations" ON media_generations;

CREATE POLICY "Users can view own brand media"
ON media_generations FOR SELECT
USING (
  user_id = auth.uid() 
  AND brand_id = (SELECT active_brand_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can create own brand media"
ON media_generations FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND brand_id = (SELECT active_brand_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update own brand media"
ON media_generations FOR UPDATE
USING (
  user_id = auth.uid() 
  AND brand_id = (SELECT active_brand_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can delete own brand media"
ON media_generations FOR DELETE
USING (
  user_id = auth.uid() 
  AND brand_id = (SELECT active_brand_id FROM profiles WHERE id = auth.uid())
);

-- 4. RLS stricte sur job_sets (renforcement)
DROP POLICY IF EXISTS "Users can view own job sets" ON job_sets;

CREATE POLICY "Users can view own brand job sets"
ON job_sets FOR SELECT
USING (
  user_id = auth.uid()
  AND brand_id = (SELECT active_brand_id FROM profiles WHERE id = auth.uid())
);

-- 5. RLS stricte sur assets (renforcement)
DROP POLICY IF EXISTS "Users can view assets from their brands" ON assets;

CREATE POLICY "Users can view own brand assets"
ON assets FOR SELECT
USING (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
  AND brand_id = (SELECT active_brand_id FROM profiles WHERE id = auth.uid())
);