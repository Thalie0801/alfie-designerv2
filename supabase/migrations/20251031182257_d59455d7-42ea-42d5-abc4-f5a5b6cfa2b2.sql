-- Set default values for quota columns to prevent NULL issues
ALTER TABLE profiles
  ALTER COLUMN woofs_consumed_this_month SET DEFAULT 0,
  ALTER COLUMN quota_videos SET DEFAULT 0,
  ALTER COLUMN generations_this_month SET DEFAULT 0,
  ALTER COLUMN quota_visuals_per_month SET DEFAULT 0;

ALTER TABLE brands
  ALTER COLUMN woofs_used SET DEFAULT 0,
  ALTER COLUMN quota_woofs SET DEFAULT 0,
  ALTER COLUMN images_used SET DEFAULT 0,
  ALTER COLUMN quota_images SET DEFAULT 0;

-- Backfill existing NULL values with 0
UPDATE profiles SET woofs_consumed_this_month = 0 WHERE woofs_consumed_this_month IS NULL;
UPDATE profiles SET quota_videos = 0 WHERE quota_videos IS NULL;
UPDATE profiles SET generations_this_month = 0 WHERE generations_this_month IS NULL;
UPDATE profiles SET quota_visuals_per_month = 0 WHERE quota_visuals_per_month IS NULL;

UPDATE brands SET woofs_used = 0 WHERE woofs_used IS NULL;
UPDATE brands SET quota_woofs = 0 WHERE quota_woofs IS NULL;
UPDATE brands SET images_used = 0 WHERE images_used IS NULL;
UPDATE brands SET quota_images = 0 WHERE quota_images IS NULL;

-- Add RLS policies for providers and provider_metrics (read access for authenticated users)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers_read_authenticated') THEN
    CREATE POLICY providers_read_authenticated ON providers FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'provider_metrics' AND policyname = 'provider_metrics_read_authenticated') THEN
    CREATE POLICY provider_metrics_read_authenticated ON provider_metrics FOR SELECT TO authenticated USING (true);
  END IF;
END $$;