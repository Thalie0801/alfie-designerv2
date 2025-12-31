-- Drop the existing constraint
ALTER TABLE public.job_queue DROP CONSTRAINT IF EXISTS job_queue_type_check;

-- Recreate with extended type list (historical + new Job Engine types)
ALTER TABLE public.job_queue ADD CONSTRAINT job_queue_type_check 
CHECK (type = ANY (ARRAY[
  -- Historical types
  'generate_texts',
  'render_images', 
  'render_carousels',
  'generate_video',
  'animate_image',
  -- New Job Engine types
  'single_image',
  'multi_image',
  'carousel',
  'multi_clip_video',
  'campaign_pack'
]));