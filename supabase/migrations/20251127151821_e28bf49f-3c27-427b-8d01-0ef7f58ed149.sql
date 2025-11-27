-- Créer la fonction RPC pour obtenir la taille des tables
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  total_size text,
  total_size_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    pg_total_relation_size(schemaname || '.' || tablename) AS total_size_bytes
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
  LIMIT 20;
END;
$$;

-- Créer une fonction de nettoyage automatique des assets expirés (30 jours)
CREATE OR REPLACE FUNCTION public.cleanup_expired_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marquer les media_generations expirés comme "expired" au lieu de les supprimer (audit trail)
  UPDATE public.media_generations
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    expires_at < NOW()
    AND status = 'completed';

  -- Log du nombre d'assets nettoyés
  RAISE NOTICE 'Expired assets cleanup completed at %', NOW();
END;
$$;

-- Note: Pour automatiser l'exécution quotidienne, il faudra configurer pg_cron
-- ou créer un webhook cron externe qui appelle purge-expired-assets
-- Exemple avec pg_cron (si disponible):
-- SELECT cron.schedule('cleanup-expired-assets', '0 3 * * *', 'SELECT public.cleanup_expired_assets()');

COMMENT ON FUNCTION public.get_table_sizes IS 'Returns the size of all public tables for monitoring';
COMMENT ON FUNCTION public.cleanup_expired_assets IS 'Marks expired media_generations as expired (called daily via cron)';