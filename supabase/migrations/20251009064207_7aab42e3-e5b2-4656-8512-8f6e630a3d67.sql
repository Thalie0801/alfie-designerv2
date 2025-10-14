-- Fix function search path security warnings

-- Recréer la fonction generate_short_job_id avec search_path sécurisé
CREATE OR REPLACE FUNCTION generate_short_job_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'JOB-';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Recréer la fonction set_job_short_id avec search_path sécurisé
CREATE OR REPLACE FUNCTION set_job_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := generate_short_job_id();
  END IF;
  RETURN NEW;
END;
$$;