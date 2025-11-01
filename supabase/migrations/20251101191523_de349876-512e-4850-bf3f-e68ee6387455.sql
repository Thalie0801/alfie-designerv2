-- Fonction de remboursement pour counters_monthly (système unifié)
CREATE OR REPLACE FUNCTION public.decrement_monthly_counters(
  p_brand_id UUID,
  p_period_yyyymm INT,
  p_images INT DEFAULT 0,
  p_reels INT DEFAULT 0,
  p_woofs INT DEFAULT 0
) RETURNS void AS $$
BEGIN
  UPDATE counters_monthly
  SET
    images_used = GREATEST(0, images_used - p_images),
    reels_used = GREATEST(0, reels_used - p_reels),
    woofs_used = GREATEST(0, woofs_used - p_woofs)
  WHERE brand_id = p_brand_id AND period_yyyymm = p_period_yyyymm;
  
  -- Si pas de ligne, no-op (pas d'erreur)
  IF NOT FOUND THEN
    RAISE NOTICE 'No counters found for brand % in period %', p_brand_id, p_period_yyyymm;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;