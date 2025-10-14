-- Add is_addon column to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_addon boolean DEFAULT false;

-- Create enum type for brand plans if it doesn't exist
DO $$ BEGIN
    CREATE TYPE brand_plan AS ENUM ('starter', 'pro', 'studio');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure plan column uses the correct type (if not already)
ALTER TABLE brands ALTER COLUMN plan TYPE text;

-- Add comment for clarity
COMMENT ON COLUMN brands.is_addon IS 'True if this brand was created via "Marque +" add-on';

-- Set default quotas based on plan for existing brands without quotas
UPDATE brands 
SET 
  quota_images = CASE 
    WHEN plan = 'starter' THEN 150
    WHEN plan = 'pro' THEN 450
    WHEN plan = 'studio' THEN 1000
    ELSE quota_images
  END,
  quota_videos = CASE 
    WHEN plan = 'starter' THEN 15
    WHEN plan = 'pro' THEN 45
    WHEN plan = 'studio' THEN 100
    ELSE quota_videos
  END,
  quota_woofs = CASE 
    WHEN plan = 'starter' THEN 15
    WHEN plan = 'pro' THEN 45
    WHEN plan = 'studio' THEN 100
    ELSE quota_woofs
  END
WHERE plan IN ('starter', 'pro', 'studio');