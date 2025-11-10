-- Pipeline reliability additions for job_queue and library_assets
BEGIN;

-- === job_queue enhancements ===
ALTER TABLE public.job_queue
  ADD COLUMN IF NOT EXISTS brand_id text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts int DEFAULT 3;

-- Backfill kind from legacy type values
UPDATE public.job_queue
SET kind = CASE
  WHEN type IN ('render_images', 'generate_images', 'generate_image', 'image') THEN 'image'
  WHEN type IN ('render_carousels', 'generate_carousel', 'carousel', 'carousel_slide') THEN 'carousel'
  WHEN type IN ('generate_video', 'render_video', 'video', 'generate_videos') THEN 'video'
  ELSE 'image'
END
WHERE kind IS NULL;

-- Backfill brand_id from orders or payload metadata
UPDATE public.job_queue jq
SET brand_id = COALESCE(
  (SELECT o.brand_id::text FROM public.orders o WHERE o.id = jq.order_id),
  jq.payload->>'brand_id',
  jq.payload->>'brandId',
  jq.payload->>'brand',
  jq.payload->>'brandID'
)
WHERE brand_id IS NULL;

UPDATE public.job_queue
SET brand_id = 'unassigned'
WHERE brand_id IS NULL;

-- Normalize legacy statuses to the new vocabulary
UPDATE public.job_queue SET status = 'queued' WHERE status = 'pending';
UPDATE public.job_queue SET status = 'processing' WHERE status = 'running';
UPDATE public.job_queue SET status = 'done' WHERE status IN ('completed', 'ready');
UPDATE public.job_queue SET status = 'error' WHERE status = 'failed';

-- Align attempts counters with retry_count if present
UPDATE public.job_queue
SET attempts = COALESCE(retry_count, attempts);

UPDATE public.job_queue
SET max_attempts = COALESCE(max_retries, max_attempts);

ALTER TABLE public.job_queue
  ALTER COLUMN brand_id SET NOT NULL,
  ALTER COLUMN kind SET NOT NULL,
  ALTER COLUMN attempts SET NOT NULL,
  ALTER COLUMN max_attempts SET NOT NULL,
  ALTER COLUMN brand_id SET DEFAULT 'unassigned',
  ALTER COLUMN kind SET DEFAULT 'image';

ALTER TABLE public.job_queue DROP CONSTRAINT IF EXISTS job_queue_kind_check;
ALTER TABLE public.job_queue
  ADD CONSTRAINT job_queue_kind_check CHECK (kind IN ('image', 'carousel', 'video'));

ALTER TABLE public.job_queue DROP CONSTRAINT IF EXISTS job_queue_status_check;
ALTER TABLE public.job_queue
  ADD CONSTRAINT job_queue_status_check CHECK (status IN (
    'queued', 'processing', 'done', 'error', 'blocked', 'retrying',
    'running', 'completed', 'failed', 'pending', 'ready'
  ));

CREATE INDEX IF NOT EXISTS job_queue_kind_idx ON public.job_queue(kind);
CREATE INDEX IF NOT EXISTS job_queue_brand_idx ON public.job_queue(brand_id);

-- Automatically hydrate kind/brand_id when new jobs are inserted
CREATE OR REPLACE FUNCTION public.fn_job_queue_apply_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind IS NULL OR NEW.kind NOT IN ('image', 'carousel', 'video') THEN
    NEW.kind := CASE NEW.type
      WHEN 'render_carousels' THEN 'carousel'
      WHEN 'generate_carousel' THEN 'carousel'
      WHEN 'carousel' THEN 'carousel'
      WHEN 'generate_video' THEN 'video'
      WHEN 'render_video' THEN 'video'
      WHEN 'video' THEN 'video'
      ELSE 'image'
    END;
  END IF;

  IF NEW.brand_id IS NULL OR NEW.brand_id = '' THEN
    SELECT COALESCE(o.brand_id::text, NEW.payload->>'brand_id', NEW.payload->>'brandId', NEW.payload->>'brand')
      INTO NEW.brand_id
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    IF NEW.brand_id IS NULL OR NEW.brand_id = '' THEN
      NEW.brand_id := 'unassigned';
    END IF;
  END IF;

  IF NEW.attempts IS NULL THEN
    NEW.attempts := COALESCE(NEW.retry_count, 0);
  END IF;

  IF NEW.max_attempts IS NULL THEN
    NEW.max_attempts := COALESCE(NEW.max_retries, 3);
  END IF;

  IF NEW.status = 'pending' THEN
    NEW.status := 'queued';
  ELSIF NEW.status = 'running' THEN
    NEW.status := 'processing';
  ELSIF NEW.status = 'completed' OR NEW.status = 'ready' THEN
    NEW.status := 'done';
  ELSIF NEW.status = 'failed' THEN
    NEW.status := 'error';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_queue_apply_defaults ON public.job_queue;
CREATE TRIGGER trg_job_queue_apply_defaults
BEFORE INSERT OR UPDATE ON public.job_queue
FOR EACH ROW
EXECUTE FUNCTION public.fn_job_queue_apply_defaults();

-- === library_assets enhancements ===
ALTER TABLE public.library_assets
  ADD COLUMN IF NOT EXISTS public_id text,
  ADD COLUMN IF NOT EXISTS secure_url text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS width int,
  ADD COLUMN IF NOT EXISTS height int,
  ADD COLUMN IF NOT EXISTS bytes int,
  ADD COLUMN IF NOT EXISTS meta jsonb;

UPDATE public.library_assets
SET secure_url = cloudinary_url
WHERE secure_url IS NULL;

UPDATE public.library_assets
SET preview_url = COALESCE(preview_url, cloudinary_url)
WHERE preview_url IS NULL;

UPDATE public.library_assets
SET meta = COALESCE(meta, metadata, '{}'::jsonb);

ALTER TABLE public.library_assets
  ALTER COLUMN secure_url SET NOT NULL,
  ALTER COLUMN meta SET DEFAULT '{}'::jsonb;

ALTER TABLE public.library_assets DROP CONSTRAINT IF EXISTS library_assets_kind_check;
ALTER TABLE public.library_assets
  ADD CONSTRAINT library_assets_kind_check CHECK (kind IN ('image', 'carousel_slide', 'video'));

CREATE INDEX IF NOT EXISTS library_assets_kind_idx ON public.library_assets(kind);
CREATE INDEX IF NOT EXISTS library_assets_brand_idx ON public.library_assets(brand_id);

COMMIT;
