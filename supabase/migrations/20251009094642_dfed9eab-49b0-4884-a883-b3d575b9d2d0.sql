-- Check if video_engine type exists and update it to support all 3 providers
DO $$ 
BEGIN
  -- Drop the existing type if it exists (will cascade to columns)
  DROP TYPE IF EXISTS video_engine CASCADE;
  
  -- Create the new enum with all 3 providers
  CREATE TYPE video_engine AS ENUM ('sora', 'seededance', 'kling');
  
  -- Add the engine column back with the new type
  ALTER TABLE media_generations
  DROP COLUMN IF EXISTS engine CASCADE;
  
  ALTER TABLE media_generations
  ADD COLUMN engine video_engine;
  
  -- Add index for provider queries
  CREATE INDEX IF NOT EXISTS idx_media_generations_engine 
  ON media_generations(engine);
  
END $$;

-- Add comment for documentation
COMMENT ON COLUMN media_generations.engine IS 'Video generation provider used: sora (Kie.ai Sora2), seededance (Replicate ByteDance), or kling (Replicate Kling)';