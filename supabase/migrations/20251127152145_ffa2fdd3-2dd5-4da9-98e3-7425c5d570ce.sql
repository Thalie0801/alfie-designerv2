-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Créer une fonction SQL simple pour le monitoring
CREATE OR REPLACE FUNCTION public.check_db_size_alert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  media_count INTEGER;
  library_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO media_count FROM public.media_generations;
  SELECT COUNT(*) INTO library_count FROM public.library_assets;
  
  IF media_count > 10000 OR library_count > 50000 THEN
    RAISE WARNING 'Database size alert: media_generations=%, library_assets=%', 
      media_count, library_count;
  END IF;
END;
$$;