-- Security fixes for overly permissive RLS policies and function search paths

-- 1. Fix overly permissive RLS policies
-- These policies were allowing any authenticated user to insert data

-- Fix profiles policy
DROP POLICY IF EXISTS "Enable insert for service role" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix affiliates policy
DROP POLICY IF EXISTS "Enable insert for service role on affiliates" ON affiliates;
-- Note: Affiliates are created via trigger on auth.users, so we allow insert only if id matches
CREATE POLICY "Service can create affiliate profiles"
  ON affiliates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix assets policy - only allow insert if user owns the brand
DROP POLICY IF EXISTS "assets_insert_service" ON assets;
CREATE POLICY "Users can insert assets for their brands"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

-- Fix deliverable policy - only allow insert if user owns the brand
DROP POLICY IF EXISTS "deliverable_insert_service" ON deliverable;
CREATE POLICY "Users can insert deliverables for their brands"
  ON deliverable
  FOR INSERT
  TO authenticated
  WITH CHECK (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

-- Fix generation_logs policy - only allow insert for own logs
DROP POLICY IF EXISTS "Service role can insert generation logs" ON generation_logs;
CREATE POLICY "Users can insert their own generation logs"
  ON generation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Fix function search paths for SECURITY DEFINER functions
-- Add SET search_path = public to functions that don't have it

CREATE OR REPLACE FUNCTION public.generate_affiliate_slug(affiliate_name text, affiliate_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(affiliate_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'affilie-' || substring(affiliate_id::text, 1, 8);
  END IF;
  
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM affiliates WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_alfie_requests(user_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_count INTEGER;
  reset_date TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT alfie_requests_this_month, alfie_requests_reset_date 
  INTO current_count, reset_date
  FROM profiles
  WHERE id = user_id_param;
  
  IF reset_date < now() THEN
    UPDATE profiles
    SET 
      alfie_requests_this_month = 1,
      alfie_requests_reset_date = date_trunc('month', now() + interval '1 month')
    WHERE id = user_id_param;
    RETURN 1;
  END IF;
  
  UPDATE profiles
  SET alfie_requests_this_month = alfie_requests_this_month + 1
  WHERE id = user_id_param;
  
  RETURN current_count + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_with_affiliate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.affiliates (id, email, name, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'active'
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_mlm_commissions(conversion_id_param uuid, direct_affiliate_id uuid, conversion_amount numeric)
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_render_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.type = 'generate_texts'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    INSERT INTO job_queue (user_id, order_id, type, status, payload)
    SELECT 
      NEW.user_id,
      oi.order_id,
      CASE WHEN oi.type = 'carousel' THEN 'render_carousels' ELSE 'render_images' END,
      'queued',
      jsonb_build_object(
        'userId', NEW.user_id,
        'orderId', oi.order_id,
        'orderItemId', oi.id,
        'brief', oi.brief_json,
        'brandId', (NEW.payload->>'brandId')::uuid,
        'imageIndex', oi.sequence_number,
        'carouselIndex', oi.sequence_number,
        'aspectRatio', COALESCE(
          (o.metadata->>'aspectRatio')::text,
          (js.constraints->>'aspectRatio')::text,
          '9:16'
        )
      )
    FROM order_items oi
    LEFT JOIN orders o ON o.id = oi.order_id
    LEFT JOIN job_sets js ON js.id = (NEW.payload->>'jobSetId')::uuid
    WHERE oi.order_id = NEW.order_id
      AND oi.status = 'text_generated'
      AND NOT EXISTS (
        SELECT 1 FROM job_queue jq
        WHERE jq.type = CASE WHEN oi.type = 'carousel' THEN 'render_carousels' ELSE 'render_images' END
          AND jq.status IN ('queued','running')
          AND (jq.payload->>'orderItemId')::uuid = oi.id
      );

    UPDATE order_items
    SET status = 'text_generated'
    WHERE order_id = NEW.order_id
      AND status IN ('pending','text_generated');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_short_job_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.purge_old_generation_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.generation_logs
  WHERE created_at < (now() - interval '30 days');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_job_short_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := generate_short_job_id();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_brand_plan_with_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE brands
  SET plan = NEW.plan
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_plan_quotas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  plan_quotas RECORD;
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND NEW.plan IS NOT NULL THEN
    SELECT woofs_per_month, visuals_per_month
    INTO plan_quotas
    FROM plans_config
    WHERE plan = NEW.plan;
    
    IF FOUND THEN
      NEW.quota_videos := plan_quotas.woofs_per_month;
      NEW.quota_visuals_per_month := plan_quotas.visuals_per_month;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.cleanup_expired_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.media_generations
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    expires_at < NOW()
    AND status = 'completed';

  RAISE NOTICE 'Expired assets cleanup completed at %', NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_db_size_alert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;