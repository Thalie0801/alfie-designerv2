-- Vérifier et activer Realtime sur la table assets
DO $$
BEGIN
  -- Ajouter la table assets à la publication Realtime si elle n'y est pas déjà
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
    RAISE NOTICE 'Realtime activé sur la table assets';
  ELSE
    RAISE NOTICE 'Realtime déjà activé sur la table assets';
  END IF;
END $$;