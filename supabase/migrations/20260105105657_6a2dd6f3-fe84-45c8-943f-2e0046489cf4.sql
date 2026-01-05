-- Add job_queue to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_queue;

-- Ensure job_queue has REPLICA IDENTITY FULL for complete row data
ALTER TABLE public.job_queue REPLICA IDENTITY FULL;

-- Also ensure job_steps has REPLICA IDENTITY FULL
ALTER TABLE public.job_steps REPLICA IDENTITY FULL;

-- And job_events
ALTER TABLE public.job_events REPLICA IDENTITY FULL;