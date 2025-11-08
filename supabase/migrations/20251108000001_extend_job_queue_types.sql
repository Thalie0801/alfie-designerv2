-- Allow carousel video stitching jobs in job_queue
alter table public.job_queue
  drop constraint if exists job_queue_type_check;

alter table public.job_queue
  add constraint job_queue_type_check
  check (type in (
    'generate_texts',
    'render_images',
    'render_carousels',
    'generate_video',
    'stitch_carousel_video'
  ));
