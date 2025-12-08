-- RLS sur password_reset_requests (table interne, accès uniquement via service role)
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Pas de policy = accès bloqué pour anon/authenticated (seul service role peut accéder)

-- Corriger search_path sur calculate_woofs_cost
CREATE OR REPLACE FUNCTION public.calculate_woofs_cost(duration_seconds integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF duration_seconds <= 8 THEN
    RETURN 1;
  ELSIF duration_seconds <= 15 THEN
    RETURN 2;
  ELSIF duration_seconds <= 30 THEN
    RETURN 4;
  ELSIF duration_seconds <= 60 THEN
    RETURN 8;
  ELSE
    RETURN 8;
  END IF;
END;
$$;

-- Corriger search_path sur update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;