-- ============================================
-- RGPD Cleanup Cron Job (30 days retention)
-- ============================================
-- Executes cloudinary-cleanup-30d every day at 3:00 AM UTC

-- Enable pg_net extension for HTTP calls (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule the cleanup job
SELECT cron.schedule(
  'rgpd-cleanup-30d',
  '0 3 * * *',  -- Every day at 3:00 AM UTC
  $$
  SELECT extensions.http_post(
    url := 'https://gbuvtzqqzyiytypenzae.supabase.co/functions/v1/cloudinary-cleanup-30d',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Also create a simpler cron job using net.http_post directly
SELECT cron.schedule(
  'rgpd-cleanup-30d-alt',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gbuvtzqqzyiytypenzae.supabase.co/functions/v1/cloudinary-cleanup-30d'::text,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);