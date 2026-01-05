-- Activer REPLICA IDENTITY FULL pour avoir toutes les données
ALTER TABLE public.job_queue REPLICA IDENTITY FULL;
ALTER TABLE public.job_events REPLICA IDENTITY FULL;