-- Add idempotency_key column to job_queue table
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_queue_idempotency_key ON job_queue(idempotency_key);

-- Add comment
COMMENT ON COLUMN job_queue.idempotency_key IS 'Unique key to prevent duplicate job submissions';