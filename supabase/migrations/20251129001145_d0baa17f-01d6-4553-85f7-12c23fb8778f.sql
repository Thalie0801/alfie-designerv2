-- 1. Update job_queue type constraint to include 'animate_image'
ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_type_check;
ALTER TABLE job_queue ADD CONSTRAINT job_queue_type_check 
  CHECK (type IN ('generate_texts', 'render_images', 'render_carousels', 'generate_video', 'animate_image'));

-- 2. Add RLS policy to allow users to insert their own jobs
CREATE POLICY "Users can create their own jobs"
  ON job_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Update usage_event kind constraint if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_event') THEN
    ALTER TABLE usage_event DROP CONSTRAINT IF EXISTS usage_event_kind_check;
    ALTER TABLE usage_event ADD CONSTRAINT usage_event_kind_check
      CHECK (kind IN ('image_ai', 'carousel_ai_image', 'reel_export', 'premium_t2v', 'animated_image'));
  END IF;
END $$;