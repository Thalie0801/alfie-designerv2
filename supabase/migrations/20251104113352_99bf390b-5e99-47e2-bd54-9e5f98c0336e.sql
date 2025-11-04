-- Enable Realtime for job_queue table to allow real-time job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_queue;