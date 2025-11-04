-- Remove the problematic unique constraint on job_queue
-- This constraint prevents creating multiple jobs of the same type for the same order
ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS uq_job_queue_order_type_status;