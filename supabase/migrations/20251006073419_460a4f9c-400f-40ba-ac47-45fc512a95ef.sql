-- Activer les extensions nécessaires pour les cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Créer un cron job qui exécute l'auto-scraping toutes les 6 heures
SELECT cron.schedule(
  'auto-scrape-canva-templates',
  '0 */6 * * *', -- Toutes les 6 heures
  $$
  SELECT
    net.http_post(
        url:='https://onxqgtuiagiuomlstcmt.supabase.co/functions/v1/auto-scrape-canva-templates',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0c2pvbmF6aWZpaWlrb3plbmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzE3MzcsImV4cCI6MjA3NTIwNzczN30.s5aKKp_MrX8Tks2m7YUmDcp0bcSzo7s2Od2cyjU0n48"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
