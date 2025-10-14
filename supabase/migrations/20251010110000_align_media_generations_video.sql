-- Harmonise media_generations for video tracking
ALTER TABLE public.media_generations DROP CONSTRAINT IF EXISTS media_generations_status_check;

UPDATE public.media_generations
SET status = 'processing'
WHERE status NOT IN ('processing', 'completed', 'failed');

ALTER TABLE public.media_generations
  ADD CONSTRAINT media_generations_status_check
  CHECK (status IN ('processing', 'completed', 'failed'));

ALTER TABLE public.media_generations DROP CONSTRAINT IF EXISTS media_generations_job_id_fkey;
ALTER TABLE public.media_generations
  ALTER COLUMN job_id TYPE text USING job_id::text;

ALTER TABLE public.media_generations
  ALTER COLUMN engine TYPE text USING engine::text;

DROP TYPE IF EXISTS public.asset_engine;
