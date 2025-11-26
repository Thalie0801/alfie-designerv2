-- Ensure job_queue table has the correct structure
-- Add payload column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_queue' AND column_name = 'payload'
  ) THEN
    ALTER TABLE job_queue ADD COLUMN payload JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add kind column if it doesn't exist (might already be there from previous migrations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'job_queue' AND column_name = 'kind'
  ) THEN
    ALTER TABLE job_queue ADD COLUMN kind TEXT;
  END IF;
END $$;

-- Create index on payload for better query performance
CREATE INDEX IF NOT EXISTS idx_job_queue_payload ON job_queue USING GIN (payload);