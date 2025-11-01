-- Fonction RPC pour consommer les visuels
CREATE OR REPLACE FUNCTION public.consume_visuals(
  user_id_param UUID,
  brand_id_param UUID,
  visuals_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Incrémenter les visuels consommés pour le profil
  UPDATE profiles
  SET generations_this_month = COALESCE(generations_this_month, 0) + visuals_amount
  WHERE id = user_id_param;
  
  -- Incrémenter également pour la marque si brand_id fourni
  IF brand_id_param IS NOT NULL THEN
    UPDATE brands
    SET images_used = COALESCE(images_used, 0) + visuals_amount
    WHERE id = brand_id_param;
  END IF;
  
  RETURN FOUND;
END;
$$;