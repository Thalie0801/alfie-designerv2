-- Add started_at and finished_at columns to job_queue
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for performance on status queries
CREATE INDEX IF NOT EXISTS idx_job_queue_status_started ON job_queue(status, started_at);