-- Activer les extensions nécessaires pour les cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Créer un job cron pour purger les assets expirés (tous les jours à 2h du matin UTC)
SELECT cron.schedule(
  'purge-expired-assets-daily',
  '0 2 * * *', -- 2h du matin chaque jour
  $$
  SELECT
    net.http_post(
        url:='https://onxqgtuiagiuomlstcmt.supabase.co/functions/v1/purge-expired-assets',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0c2pvbmF6aWZpaWlrb3plbmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzE3MzcsImV4cCI6MjA3NTIwNzczN30.s5aKKp_MrX8Tks2m7YUmDcp0bcSzo7s2Od2cyjU0n48"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Créer un job cron pour reset des quotas mensuels (le 1er de chaque mois à 1h du matin UTC)
SELECT cron.schedule(
  'reset-monthly-quotas',
  '0 1 1 * *', -- 1h du matin le 1er de chaque mois
  $$
  SELECT
    net.http_post(
        url:='https://onxqgtuiagiuomlstcmt.supabase.co/functions/v1/reset-monthly-quotas',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0c2pvbmF6aWZpaWlrb3plbmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzE3MzcsImV4cCI6MjA3NTIwNzczN30.s5aKKp_MrX8Tks2m7YUmDcp0bcSzo7s2Od2cyjU0n48"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Ajouter un index pour améliorer les performances de la purge
CREATE INDEX IF NOT EXISTS idx_media_generations_expires_status 
ON public.media_generations(expires_at, status)
WHERE status = 'completed';

-- Commentaires
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - utilisé pour purge assets et reset quotas';
COMMENT ON EXTENSION pg_net IS 'Async HTTP client for PostgreSQL - utilisé pour appeler les edge functions';