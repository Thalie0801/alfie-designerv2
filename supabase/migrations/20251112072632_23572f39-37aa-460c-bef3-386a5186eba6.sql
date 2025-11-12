-- ============================================
-- PHASE 1: CORRECTIFS DE SÉCURITÉ CRITIQUES
-- ============================================

-- 1. RESTREINDRE RLS SUR JOB_QUEUE
-- Supprimer la policy trop permissive
DROP POLICY IF EXISTS "jq_service_all" ON public.job_queue;

-- Créer policy restrictive: users voient seulement leurs jobs
CREATE POLICY "users_view_own_jobs" ON public.job_queue
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role peut tout gérer (pour edge functions)
CREATE POLICY "service_role_manages_jobs" ON public.job_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. RENDRE STORAGE BUCKETS PRIVÉS
UPDATE storage.buckets 
SET public = false 
WHERE name IN ('media-generations', 'chat-uploads');

-- Créer RLS policies pour storage.objects
DROP POLICY IF EXISTS "users_access_own_media" ON storage.objects;
DROP POLICY IF EXISTS "users_upload_own_media" ON storage.objects;

CREATE POLICY "users_access_own_media" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('media-generations', 'chat-uploads')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "users_upload_own_media" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('media-generations', 'chat-uploads')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "users_delete_own_media" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('media-generations', 'chat-uploads')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. AJOUTER SET search_path = public AUX SECURITY DEFINER FUNCTIONS

-- consume_woofs
CREATE OR REPLACE FUNCTION public.consume_woofs(
  user_id_param uuid, 
  woofs_amount integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE profiles
  SET woofs_consumed_this_month = COALESCE(woofs_consumed_this_month, 0) + woofs_amount
  WHERE id = user_id_param;
  RETURN FOUND;
END;
$function$;

-- refund_woofs
CREATE OR REPLACE FUNCTION public.refund_woofs(
  user_id_param uuid, 
  woofs_amount integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE profiles
  SET woofs_consumed_this_month = GREATEST(0, COALESCE(woofs_consumed_this_month, 0) - woofs_amount)
  WHERE id = user_id_param;
  RETURN FOUND;
END;
$function$;

-- reserve_brand_quotas
CREATE OR REPLACE FUNCTION public.reserve_brand_quotas(
  p_brand_id uuid, 
  p_visuals_count integer DEFAULT 0, 
  p_reels_count integer DEFAULT 0, 
  p_woofs_count integer DEFAULT 0
)
RETURNS TABLE(success boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_quota_ok BOOLEAN;
BEGIN
  PERFORM * FROM brands WHERE id = p_brand_id FOR UPDATE;
  
  SELECT 
    (images_used + p_visuals_count <= quota_images) AND
    (videos_used + p_reels_count <= quota_videos) AND
    (woofs_used + p_woofs_count <= quota_woofs)
  INTO v_quota_ok
  FROM brands
  WHERE id = p_brand_id;
  
  IF NOT v_quota_ok THEN
    RETURN QUERY SELECT false, 'Quota exceeded'::TEXT;
    RETURN;
  END IF;
  
  UPDATE brands
  SET
    images_used = images_used + p_visuals_count,
    videos_used = videos_used + p_reels_count,
    woofs_used = woofs_used + p_woofs_count,
    updated_at = now()
  WHERE id = p_brand_id;
  
  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$function$;

-- refund_brand_quotas
CREATE OR REPLACE FUNCTION public.refund_brand_quotas(
  p_brand_id uuid, 
  p_visuals_count integer DEFAULT 0, 
  p_reels_count integer DEFAULT 0, 
  p_woofs_count integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE brands
  SET
    images_used = GREATEST(0, images_used - p_visuals_count),
    videos_used = GREATEST(0, videos_used - p_reels_count),
    woofs_used = GREATEST(0, woofs_used - p_woofs_count),
    updated_at = now()
  WHERE id = p_brand_id;
  
  RETURN FOUND;
END;
$function$;

-- increment_profile_visuals
CREATE OR REPLACE FUNCTION public.increment_profile_visuals(
  p_profile_id uuid, 
  p_delta integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE profiles
  SET 
    generations_this_month = generations_this_month + p_delta,
    updated_at = now()
  WHERE id = p_profile_id;
END;
$function$;

-- consume_visuals
CREATE OR REPLACE FUNCTION public.consume_visuals(
  user_id_param uuid, 
  brand_id_param uuid, 
  visuals_amount integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE profiles
  SET generations_this_month = COALESCE(generations_this_month, 0) + visuals_amount
  WHERE id = user_id_param;
  
  IF brand_id_param IS NOT NULL THEN
    UPDATE brands
    SET images_used = COALESCE(images_used, 0) + visuals_amount
    WHERE id = brand_id_param;
  END IF;
  
  RETURN FOUND;
END;
$function$;

-- update_affiliate_status
CREATE OR REPLACE FUNCTION public.update_affiliate_status(affiliate_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  direct_referrals integer;
  new_status text;
BEGIN
  SELECT COUNT(DISTINCT a.id) INTO direct_referrals
  FROM affiliates a
  JOIN affiliate_conversions ac ON ac.affiliate_id = a.id
  WHERE a.parent_id = affiliate_id_param
    AND a.status = 'active'
    AND ac.status = 'paid';
  
  IF direct_referrals >= 5 THEN
    new_status := 'leader';
  ELSIF direct_referrals >= 3 THEN
    new_status := 'mentor';
  ELSE
    new_status := 'creator';
  END IF;
  
  UPDATE affiliates
  SET 
    affiliate_status = new_status,
    active_direct_referrals = direct_referrals
  WHERE id = affiliate_id_param;
END;
$function$;

-- calculate_mlm_commissions
CREATE OR REPLACE FUNCTION public.calculate_mlm_commissions(
  conversion_id_param uuid, 
  direct_affiliate_id uuid, 
  conversion_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_affiliate_id uuid;
  current_level integer := 1;
  commission_rate numeric;
  commission_amount numeric;
  affiliate_record record;
BEGIN
  current_affiliate_id := direct_affiliate_id;
  
  WHILE current_affiliate_id IS NOT NULL AND current_level <= 3 LOOP
    SELECT * INTO affiliate_record FROM affiliates WHERE id = current_affiliate_id;
    
    IF NOT FOUND THEN
      EXIT;
    END IF;
    
    IF current_level = 1 THEN
      IF affiliate_record.status = 'active' THEN
        commission_rate := 0.15;
      ELSE
        commission_rate := 0;
      END IF;
    ELSIF current_level = 2 THEN
      IF affiliate_record.affiliate_status IN ('mentor', 'leader') AND affiliate_record.active_direct_referrals >= 3 THEN
        commission_rate := 0.05;
      ELSE
        commission_rate := 0;
      END IF;
    ELSIF current_level = 3 THEN
      IF affiliate_record.affiliate_status = 'leader' AND affiliate_record.active_direct_referrals >= 5 THEN
        commission_rate := 0.02;
      ELSE
        commission_rate := 0;
      END IF;
    END IF;
    
    IF commission_rate > 0 THEN
      commission_amount := conversion_amount * commission_rate;
      
      INSERT INTO affiliate_commissions (affiliate_id, conversion_id, level, commission_rate, amount)
      VALUES (current_affiliate_id, conversion_id_param, current_level, commission_rate, commission_amount)
      ON CONFLICT (affiliate_id, conversion_id, level) DO NOTHING;
    END IF;
    
    current_affiliate_id := affiliate_record.parent_id;
    current_level := current_level + 1;
  END LOOP;
END;
$function$;