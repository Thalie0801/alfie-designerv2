CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'user',
    'admin',
    'affiliate',
    'vip'
);


--
-- Name: asset_engine; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_engine AS ENUM (
    'nano',
    'sora',
    'veo3'
);


--
-- Name: brand_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.brand_plan AS ENUM (
    'starter',
    'pro',
    'studio'
);


--
-- Name: plan_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_type AS ENUM (
    'starter',
    'pro',
    'studio'
);


--
-- Name: video_engine; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.video_engine AS ENUM (
    'sora',
    'seededance',
    'kling'
);


--
-- Name: calculate_mlm_commissions(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_mlm_commissions(conversion_id_param uuid, direct_affiliate_id uuid, conversion_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: calculate_woofs_cost(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_woofs_cost(duration_seconds integer) RETURNS integer
    LANGUAGE plpgsql
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


--
-- Name: can_create_video(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_create_video(user_id_param uuid, duration_seconds integer) RETURNS TABLE(can_create boolean, reason text, woofs_available integer, woofs_needed integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_profile RECORD;
  woofs_cost INT;
  allowed_durations TEXT;
BEGIN
  SELECT * INTO user_profile FROM profiles WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User profile not found', 0, 0;
    RETURN;
  END IF;
  
  IF user_profile.plan IS NULL OR user_profile.plan = 'none' THEN
    RETURN QUERY SELECT false, 'No active plan', 0, 0;
    RETURN;
  END IF;
  
  woofs_cost := calculate_woofs_cost(duration_seconds);
  
  SELECT durations INTO allowed_durations 
  FROM plans_config 
  WHERE plan = user_profile.plan;
  
  IF NOT (allowed_durations::jsonb ? duration_seconds::text) THEN
    RETURN QUERY SELECT 
      false, 
      'Duration not allowed for your plan', 
      COALESCE(user_profile.quota_videos, 0) - COALESCE(user_profile.woofs_consumed_this_month, 0),
      woofs_cost;
    RETURN;
  END IF;
  
  IF COALESCE(user_profile.woofs_consumed_this_month, 0) + woofs_cost > COALESCE(user_profile.quota_videos, 0) THEN
    RETURN QUERY SELECT 
      false, 
      'Insufficient Woofs', 
      COALESCE(user_profile.quota_videos, 0) - COALESCE(user_profile.woofs_consumed_this_month, 0),
      woofs_cost;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    true, 
    'OK', 
    COALESCE(user_profile.quota_videos, 0) - COALESCE(user_profile.woofs_consumed_this_month, 0),
    woofs_cost;
END;
$$;


--
-- Name: claim_next_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_next_job() RETURNS TABLE(id uuid, order_id uuid, user_id uuid, type text, payload jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT jq.id
    FROM job_queue jq
    WHERE jq.status = 'queued'
    ORDER BY jq.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue jq
  SET 
    status = 'running',
    updated_at = now(),
    attempts = COALESCE(attempts, 0) + 1
  FROM claimed
  WHERE jq.id = claimed.id
  RETURNING jq.id, jq.order_id, jq.user_id, jq.type, jq.payload;
END;
$$;


--
-- Name: consume_visuals(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_visuals(user_id_param uuid, brand_id_param uuid, visuals_amount integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: consume_woofs(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_woofs(user_id_param uuid, woofs_amount integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE profiles
  SET woofs_consumed_this_month = COALESCE(woofs_consumed_this_month, 0) + woofs_amount
  WHERE id = user_id_param;
  RETURN FOUND;
END;
$$;


--
-- Name: decrement_monthly_counters(uuid, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_monthly_counters(p_brand_id uuid, p_period_yyyymm integer, p_images integer DEFAULT 0, p_reels integer DEFAULT 0, p_woofs integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: enqueue_render_jobs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_render_jobs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.type = 'generate_texts'
     AND NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Create one render job per order_item that had texts generated
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
      -- Deduplicate strictly by order_item_id
      AND NOT EXISTS (
        SELECT 1 FROM job_queue jq
        WHERE jq.type = CASE WHEN oi.type = 'carousel' THEN 'render_carousels' ELSE 'render_images' END
          AND jq.status IN ('queued','running')
          AND (jq.payload->>'orderItemId')::uuid = oi.id
      );

    -- Keep current status alignment post-enqueue
    UPDATE order_items
    SET status = 'text_generated'
    WHERE order_id = NEW.order_id
      AND status IN ('pending','text_generated');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: generate_short_job_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_short_job_id() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;


--
-- Name: handle_new_user_with_affiliate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_with_affiliate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Créer le profil
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  -- Créer automatiquement un compte affilié (ou mettre à jour l'ID si l'email existe déjà)
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
$$;


--
-- Name: has_active_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_plan(user_id_param uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id_param
      AND plan IS NOT NULL
      AND plan != 'none'
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: increment_alfie_requests(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_alfie_requests(user_id_param uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: increment_monthly_counters(uuid, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_monthly_counters(p_brand_id uuid, p_period_yyyymm integer, p_images integer DEFAULT 0, p_reels integer DEFAULT 0, p_woofs integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO counters_monthly (brand_id, period_yyyymm, images_used, reels_used, woofs_used)
  VALUES (p_brand_id, p_period_yyyymm, p_images, p_reels, p_woofs)
  ON CONFLICT (brand_id, period_yyyymm)
  DO UPDATE SET
    images_used = counters_monthly.images_used + EXCLUDED.images_used,
    reels_used = counters_monthly.reels_used + EXCLUDED.reels_used,
    woofs_used = counters_monthly.woofs_used + EXCLUDED.woofs_used;
END;
$$;


--
-- Name: increment_profile_visuals(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_profile_visuals(p_profile_id uuid, p_delta integer DEFAULT 1) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE profiles
  SET 
    generations_this_month = generations_this_month + p_delta,
    updated_at = now()
  WHERE id = p_profile_id;
END;
$$;


--
-- Name: purge_old_generation_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_old_generation_logs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.generation_logs
  WHERE created_at < (now() - interval '30 days');
  RETURN NEW;
END;
$$;


--
-- Name: refund_brand_quotas(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_brand_quotas(p_brand_id uuid, p_visuals_count integer DEFAULT 0, p_reels_count integer DEFAULT 0, p_woofs_count integer DEFAULT 0) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: refund_woofs(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_woofs(user_id_param uuid, woofs_amount integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE profiles
  SET woofs_consumed_this_month = GREATEST(0, COALESCE(woofs_consumed_this_month, 0) - woofs_amount)
  WHERE id = user_id_param;
  RETURN FOUND;
END;
$$;


--
-- Name: reserve_brand_quotas(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_brand_quotas(p_brand_id uuid, p_visuals_count integer DEFAULT 0, p_reels_count integer DEFAULT 0, p_woofs_count integer DEFAULT 0) RETURNS TABLE(success boolean, reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: reset_stuck_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_stuck_jobs(age_minutes integer DEFAULT 5) RETURNS TABLE(reset_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  affected_rows BIGINT;
BEGIN
  UPDATE job_queue
  SET 
    status = 'queued',
    updated_at = now(),
    retry_count = COALESCE(retry_count, 0) + 1
  WHERE status = 'running'
    AND updated_at < (now() - (age_minutes || ' minutes')::interval)
    AND COALESCE(retry_count, 0) < 3;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  -- Marquer comme failed après 3 tentatives
  UPDATE job_queue
  SET status = 'failed', updated_at = now()
  WHERE status = 'running'
    AND updated_at < (now() - (age_minutes || ' minutes')::interval)
    AND COALESCE(retry_count, 0) >= 3;
  
  RETURN QUERY SELECT affected_rows;
END;
$$;


--
-- Name: set_job_short_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_job_short_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := generate_short_job_id();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_brand_plan_with_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_brand_plan_with_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Quand on met à jour le plan d'un profil, synchroniser avec toutes ses marques
  UPDATE brands
  SET plan = NEW.plan
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;


--
-- Name: sync_plan_quotas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_plan_quotas() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  plan_quotas RECORD;
BEGIN
  -- Si le plan a changé
  IF NEW.plan IS DISTINCT FROM OLD.plan AND NEW.plan IS NOT NULL THEN
    -- Récupérer les quotas du plan depuis plans_config
    SELECT woofs_per_month, visuals_per_month
    INTO plan_quotas
    FROM plans_config
    WHERE plan = NEW.plan;
    
    -- Mettre à jour les quotas du profil
    IF FOUND THEN
      NEW.quota_videos := plan_quotas.woofs_per_month;
      NEW.quota_visuals_per_month := plan_quotas.visuals_per_month;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_affiliate_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_affiliate_status(affiliate_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: user_has_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_access(user_id_param uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  profile_record RECORD;
BEGIN
  SELECT plan, stripe_subscription_id, granted_by_admin
  INTO profile_record
  FROM profiles
  WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN (
    (profile_record.plan IS NOT NULL AND profile_record.plan != 'none' AND profile_record.stripe_subscription_id IS NOT NULL)
    OR profile_record.granted_by_admin = true
  );
END;
$$;


SET default_table_access_method = heap;

--
-- Name: affiliate_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    click_id text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    conversion_id uuid NOT NULL,
    level integer NOT NULL,
    commission_rate numeric NOT NULL,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT affiliate_commissions_level_check CHECK ((level = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: affiliate_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    user_id uuid NOT NULL,
    plan text NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    period text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);


--
-- Name: affiliates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    payout_method text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    affiliate_status text DEFAULT 'creator'::text,
    active_direct_referrals integer DEFAULT 0,
    total_referrals_level_2 integer DEFAULT 0,
    total_referrals_level_3 integer DEFAULT 0,
    stripe_connect_account_id text,
    stripe_connect_onboarding_complete boolean DEFAULT false,
    stripe_connect_charges_enabled boolean DEFAULT false,
    stripe_connect_payouts_enabled boolean DEFAULT false,
    CONSTRAINT affiliates_affiliate_status_check CHECK ((affiliate_status = ANY (ARRAY['creator'::text, 'mentor'::text, 'leader'::text])))
);


--
-- Name: alfie_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alfie_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prompt_hash text NOT NULL,
    prompt_type text NOT NULL,
    response jsonb NOT NULL,
    usage_count integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: alfie_conversation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alfie_conversation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid,
    order_id uuid,
    conversation_state text DEFAULT 'initial'::text NOT NULL,
    context_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alfie_conversation_sessions_conversation_state_check CHECK ((conversation_state = ANY (ARRAY['initial'::text, 'collecting_image_brief'::text, 'collecting_carousel_brief'::text, 'confirming'::text, 'generating'::text, 'completed'::text])))
);


--
-- Name: alfie_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alfie_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alfie_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alfie_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    video_url text,
    asset_id uuid,
    asset_type text,
    output_url text,
    expires_at timestamp with time zone,
    engine text,
    woofs_consumed integer,
    CONSTRAINT alfie_messages_asset_type_check CHECK ((asset_type = ANY (ARRAY['image'::text, 'video'::text]))),
    CONSTRAINT alfie_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    brand_id uuid,
    job_id uuid,
    job_set_id uuid,
    storage_key text NOT NULL,
    mime text DEFAULT 'image/png'::text NOT NULL,
    width integer,
    height integer,
    checksum text,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    index_in_set integer
);


--
-- Name: batch_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    modality text NOT NULL,
    payload_json jsonb NOT NULL,
    process_after timestamp with time zone NOT NULL,
    status text DEFAULT 'queued'::text,
    result_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT batch_requests_modality_check CHECK ((modality = ANY (ARRAY['image'::text, 'video'::text]))),
    CONSTRAINT batch_requests_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    palette jsonb DEFAULT '[]'::jsonb,
    fonts jsonb DEFAULT '{}'::jsonb,
    logo_url text,
    voice text,
    canva_connected boolean DEFAULT false,
    canva_team_id text,
    canva_access_token text,
    canva_refresh_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan text,
    quota_images integer DEFAULT 0,
    quota_videos integer DEFAULT 0,
    quota_woofs integer DEFAULT 0,
    images_used integer DEFAULT 0,
    videos_used integer DEFAULT 0,
    woofs_used integer DEFAULT 0,
    resets_on date DEFAULT (date_trunc('month'::text, (now() + '1 mon'::interval)))::date,
    stripe_subscription_id text,
    is_addon boolean DEFAULT false,
    niche text,
    is_default boolean DEFAULT false
);


--
-- Name: canva_designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canva_designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    image_url text NOT NULL,
    canva_url text NOT NULL,
    description text,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_interaction timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    phone text,
    message text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: counters_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counters_monthly (
    brand_id uuid NOT NULL,
    period_yyyymm integer NOT NULL,
    images_used integer DEFAULT 0 NOT NULL,
    reels_used integer DEFAULT 0 NOT NULL,
    woofs_used integer DEFAULT 0 NOT NULL
);


--
-- Name: credit_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    credits integer NOT NULL,
    price_cents integer NOT NULL,
    stripe_price_id text NOT NULL,
    discount_percentage integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    transaction_type text NOT NULL,
    action text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credit_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['monthly_reset'::text, 'purchase'::text, 'affiliation_conversion'::text, 'usage'::text])))
);


--
-- Name: deliverable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliverable (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    format text NOT NULL,
    objective text,
    style_choice text,
    status text DEFAULT 'pending'::text NOT NULL,
    preview_url text,
    canva_link text,
    zip_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deliverable_format_check CHECK ((format = ANY (ARRAY['image'::text, 'carousel'::text, 'reel'::text]))),
    CONSTRAINT deliverable_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'preview'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT deliverable_style_choice_check CHECK ((style_choice = ANY (ARRAY['template_canva'::text, 'ia'::text])))
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    feature text NOT NULL,
    enabled boolean DEFAULT true,
    allowed_plans text[] DEFAULT '{}'::text[],
    allowed_roles text[] DEFAULT '{admin,vip}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: generation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_id uuid,
    user_id uuid NOT NULL,
    type text NOT NULL,
    engine text,
    prompt_summary text,
    woofs_cost integer DEFAULT 0,
    status text NOT NULL,
    duration_seconds integer,
    error_code text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT generation_logs_engine_check CHECK ((engine = ANY (ARRAY['nano'::text, 'sora'::text, 'veo3'::text]))),
    CONSTRAINT generation_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT generation_logs_type_check CHECK ((type = ANY (ARRAY['image'::text, 'video'::text])))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL,
    result_ref text,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    CONSTRAINT idempotency_keys_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text])))
);


--
-- Name: job_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid,
    type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    payload jsonb NOT NULL,
    result jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    idempotency_key text,
    kind text,
    brand_id uuid,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    CONSTRAINT job_queue_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT job_queue_type_check CHECK ((type = ANY (ARRAY['generate_texts'::text, 'render_images'::text, 'render_carousels'::text, 'generate_video'::text])))
);


--
-- Name: job_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    request_text text NOT NULL,
    total integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    master_seed text,
    style_ref_asset_id uuid,
    constraints jsonb DEFAULT '{}'::jsonb,
    style_ref_url text,
    CONSTRAINT job_sets_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'partial'::text, 'done'::text, 'failed'::text, 'canceled'::text]))),
    CONSTRAINT job_sets_total_check CHECK (((total >= 1) AND (total <= 10)))
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_set_id uuid NOT NULL,
    index_in_set integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    prompt text NOT NULL,
    brand_snapshot jsonb NOT NULL,
    asset_id uuid,
    error text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    slide_template text,
    retry_count integer DEFAULT 0,
    coherence_threshold integer DEFAULT 75,
    CONSTRAINT jobs_index_in_set_check CHECK ((index_in_set >= 0)),
    CONSTRAINT jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: library_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.library_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    order_item_id uuid,
    user_id uuid NOT NULL,
    brand_id uuid,
    type text NOT NULL,
    campaign text,
    cloudinary_url text NOT NULL,
    cloudinary_public_id text,
    text_json jsonb DEFAULT '{}'::jsonb,
    format text,
    tags text[] DEFAULT '{}'::text[],
    slide_index integer,
    carousel_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT library_assets_type_check CHECK ((type = ANY (ARRAY['image'::text, 'carousel_slide'::text])))
);


--
-- Name: media_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    prompt text,
    input_url text,
    output_url text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brand_id uuid NOT NULL,
    woofs integer DEFAULT 0,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    thumbnail_url text,
    duration_seconds integer,
    file_size_bytes integer,
    is_source_upload boolean DEFAULT false,
    job_id uuid,
    engine public.video_engine,
    modality text,
    provider_id text,
    params_json jsonb,
    brand_score integer,
    cost_woofs integer,
    render_url text,
    error_json jsonb,
    CONSTRAINT media_generations_brand_score_check CHECK (((brand_score >= 0) AND (brand_score <= 100))),
    CONSTRAINT media_generations_modality_check CHECK ((modality = ANY (ARRAY['image'::text, 'video'::text]))),
    CONSTRAINT media_generations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT media_generations_type_check CHECK ((type = ANY (ARRAY['image'::text, 'video'::text, 'improved_image'::text])))
);


--
-- Name: library_assets_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.library_assets_view AS
 SELECT media_generations.id,
    media_generations.user_id,
    media_generations.brand_id,
    'image'::text AS type,
    media_generations.output_url AS url,
    media_generations.thumbnail_url AS thumb_url,
    media_generations.created_at,
    media_generations.metadata
   FROM public.media_generations
  WHERE ((media_generations.output_url ~~ 'https://res.cloudinary.com/%'::text) AND (media_generations.status = 'completed'::text))
UNION ALL
 SELECT library_assets.id,
    library_assets.user_id,
    library_assets.brand_id,
    library_assets.type,
    library_assets.cloudinary_url AS url,
    library_assets.cloudinary_url AS thumb_url,
    library_assets.created_at,
    library_assets.metadata
   FROM public.library_assets
  WHERE (library_assets.cloudinary_url ~~ 'https://res.cloudinary.com/%'::text);


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    type text NOT NULL,
    sequence_number integer NOT NULL,
    brief_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    text_json jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT order_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'text_generated'::text, 'visual_generating'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT order_items_type_check CHECK ((type = ANY (ARRAY['image'::text, 'carousel'::text])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid,
    campaign_name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    brief_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'brief_collection'::text, 'text_generation'::text, 'visual_generation'::text, 'rendering'::text, 'queued'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: payment_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    user_id uuid,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    plan text NOT NULL,
    amount numeric,
    email text,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_plan CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'studio'::text, 'enterprise'::text])))
);


--
-- Name: payment_verification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_verification_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    user_id uuid,
    ip_address text,
    user_agent text,
    result text NOT NULL,
    error_details text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_verification_log_result_check CHECK ((result = ANY (ARRAY['success'::text, 'duplicate'::text, 'fraud'::text, 'error'::text])))
);


--
-- Name: plans_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_config (
    plan text NOT NULL,
    woofs_per_month integer NOT NULL,
    visuals_per_month integer NOT NULL,
    durations text NOT NULL,
    storage_days integer NOT NULL,
    price_eur integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT plans_config_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'studio'::text])))
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    brand_key text,
    template_key text,
    canva_design_id text,
    title text,
    planner_deep_link text,
    suggested_slots jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan text,
    quota_visuals_per_month integer DEFAULT 0,
    quota_brands integer DEFAULT 0,
    stripe_customer_id text,
    stripe_subscription_id text,
    ai_credits_monthly integer DEFAULT 0,
    ai_credits_purchased integer DEFAULT 0,
    ai_credits_from_affiliation integer DEFAULT 0,
    credits_reset_date timestamp with time zone DEFAULT now(),
    alfie_requests_this_month integer DEFAULT 0,
    alfie_requests_reset_date timestamp with time zone DEFAULT date_trunc('month'::text, (now() + '1 mon'::interval)),
    active_brand_id uuid,
    generations_this_month integer DEFAULT 0,
    generations_reset_date timestamp with time zone DEFAULT date_trunc('month'::text, (now() + '1 mon'::interval)),
    quota_videos integer DEFAULT 0,
    videos_this_month integer DEFAULT 0,
    woofs_consumed_this_month integer DEFAULT 0,
    granted_by_admin boolean DEFAULT false
);


--
-- Name: provider_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_metrics (
    provider_id text NOT NULL,
    use_case text NOT NULL,
    format text NOT NULL,
    trials integer DEFAULT 0,
    successes integer DEFAULT 0,
    total_reward numeric DEFAULT 0,
    avg_reward numeric GENERATED ALWAYS AS (
CASE
    WHEN (trials > 0) THEN (total_reward / (trials)::numeric)
    ELSE (0)::numeric
END) STORED,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id text NOT NULL,
    family text NOT NULL,
    modalities text[] NOT NULL,
    formats text[] NOT NULL,
    strengths text[] NOT NULL,
    cost_json jsonb NOT NULL,
    quality_score numeric DEFAULT 0.8 NOT NULL,
    avg_latency_s integer DEFAULT 60 NOT NULL,
    fail_rate numeric DEFAULT 0.03 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    canva_template_id text NOT NULL,
    ratios jsonb DEFAULT '[]'::jsonb,
    variables jsonb DEFAULT '[]'::jsonb,
    folder_path text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    tx_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    delta_woofs integer NOT NULL,
    reason text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    deliverable_id uuid,
    kind text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usage_event_kind_check CHECK ((kind = ANY (ARRAY['image_ai'::text, 'carousel_ai_image'::text, 'reel_export'::text, 'premium_t2v'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_brand_quota_current; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_brand_quota_current AS
 SELECT id AS brand_id,
    name,
    plan,
    quota_images,
    quota_videos,
    quota_woofs,
    images_used,
    videos_used,
    woofs_used,
        CASE
            WHEN (quota_images > 0) THEN round((((images_used)::numeric / (quota_images)::numeric) * (100)::numeric), 0)
            ELSE (0)::numeric
        END AS images_usage_pct,
        CASE
            WHEN (quota_videos > 0) THEN round((((videos_used)::numeric / (quota_videos)::numeric) * (100)::numeric), 0)
            ELSE (0)::numeric
        END AS videos_usage_pct,
        CASE
            WHEN (quota_woofs > 0) THEN round((((woofs_used)::numeric / (quota_woofs)::numeric) * (100)::numeric), 0)
            ELSE (0)::numeric
        END AS woofs_usage_pct,
    resets_on,
    user_id
   FROM public.brands b;


--
-- Name: v_unified_assets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_unified_assets AS
 SELECT assets.id,
    assets.brand_id,
    (assets.meta ->> 'public_url'::text) AS output_url,
    ((assets.meta ->> 'job_set_id'::text))::uuid AS job_set_id,
    assets.mime AS type,
    assets.meta,
    assets.created_at
   FROM public.assets
UNION ALL
 SELECT media_generations.id,
    media_generations.brand_id,
    media_generations.output_url,
    ((media_generations.metadata ->> 'job_set_id'::text))::uuid AS job_set_id,
    media_generations.type,
    media_generations.metadata AS meta,
    media_generations.created_at
   FROM public.media_generations
  WHERE (NOT (EXISTS ( SELECT 1
           FROM public.assets
          WHERE (assets.id = media_generations.id))));


--
-- Name: video_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_video_id uuid,
    segment_index integer NOT NULL,
    segment_url text NOT NULL,
    duration_seconds integer,
    is_temporary boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand_id uuid,
    title text NOT NULL,
    duration integer NOT NULL,
    ratio text DEFAULT '16:9'::text NOT NULL,
    template_id text,
    status text DEFAULT 'queued'::text NOT NULL,
    video_url text,
    thumbnail_url text,
    assets jsonb DEFAULT '[]'::jsonb,
    tts_config jsonb,
    error_message text,
    rendering_started_at timestamp with time zone,
    rendering_completed_at timestamp with time zone,
    file_size_bytes integer,
    woofs_cost integer DEFAULT 1 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT videos_duration_check CHECK ((duration = ANY (ARRAY[8, 15, 30, 60]))),
    CONSTRAINT videos_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'rendering'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: woof_pack_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.woof_pack_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pack_id uuid NOT NULL,
    woofs integer NOT NULL,
    price_eur integer NOT NULL,
    stripe_payment_intent_id text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT woof_pack_purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: woof_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.woof_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    woofs integer NOT NULL,
    price_eur integer NOT NULL,
    stripe_price_id text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliate_clicks affiliate_clicks_click_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_click_id_key UNIQUE (click_id);


--
-- Name: affiliate_clicks affiliate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);


--
-- Name: affiliate_commissions affiliate_commissions_affiliate_id_conversion_id_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_affiliate_id_conversion_id_level_key UNIQUE (affiliate_id, conversion_id, level);


--
-- Name: affiliate_commissions affiliate_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_conversions affiliate_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_email_key UNIQUE (email);


--
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- Name: alfie_cache alfie_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_cache
    ADD CONSTRAINT alfie_cache_pkey PRIMARY KEY (id);


--
-- Name: alfie_cache alfie_cache_prompt_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_cache
    ADD CONSTRAINT alfie_cache_prompt_hash_key UNIQUE (prompt_hash);


--
-- Name: alfie_conversation_sessions alfie_conversation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_conversation_sessions
    ADD CONSTRAINT alfie_conversation_sessions_pkey PRIMARY KEY (id);


--
-- Name: alfie_conversations alfie_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_conversations
    ADD CONSTRAINT alfie_conversations_pkey PRIMARY KEY (id);


--
-- Name: alfie_messages alfie_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_messages
    ADD CONSTRAINT alfie_messages_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: batch_requests batch_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_requests
    ADD CONSTRAINT batch_requests_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: canva_designs canva_designs_canva_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canva_designs
    ADD CONSTRAINT canva_designs_canva_url_key UNIQUE (canva_url);


--
-- Name: canva_designs canva_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canva_designs
    ADD CONSTRAINT canva_designs_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_user_id_brand_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_brand_id_key UNIQUE (user_id, brand_id);


--
-- Name: contact_requests contact_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_pkey PRIMARY KEY (id);


--
-- Name: counters_monthly counters_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counters_monthly
    ADD CONSTRAINT counters_monthly_pkey PRIMARY KEY (brand_id, period_yyyymm);


--
-- Name: credit_packs credit_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packs
    ADD CONSTRAINT credit_packs_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: deliverable deliverable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable
    ADD CONSTRAINT deliverable_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (feature);


--
-- Name: generation_logs generation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_logs
    ADD CONSTRAINT generation_logs_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);


--
-- Name: job_queue job_queue_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: job_queue job_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_pkey PRIMARY KEY (id);


--
-- Name: job_sets job_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_sets
    ADD CONSTRAINT job_sets_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_job_set_id_index_in_set_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_job_set_id_index_in_set_key UNIQUE (job_set_id, index_in_set);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_unique_in_set; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_unique_in_set UNIQUE (job_set_id, index_in_set);


--
-- Name: library_assets library_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_assets
    ADD CONSTRAINT library_assets_pkey PRIMARY KEY (id);


--
-- Name: media_generations media_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_generations
    ADD CONSTRAINT media_generations_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_sessions payment_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_pkey PRIMARY KEY (id);


--
-- Name: payment_sessions payment_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_session_id_key UNIQUE (session_id);


--
-- Name: payment_sessions payment_sessions_session_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_session_id_unique UNIQUE (session_id);


--
-- Name: payment_verification_log payment_verification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_verification_log
    ADD CONSTRAINT payment_verification_log_pkey PRIMARY KEY (id);


--
-- Name: plans_config plans_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_config
    ADD CONSTRAINT plans_config_pkey PRIMARY KEY (plan);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: provider_metrics provider_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_metrics
    ADD CONSTRAINT provider_metrics_pkey PRIMARY KEY (provider_id, use_case, format);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: templates templates_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_key_key UNIQUE (key);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (tx_id);


--
-- Name: order_items uq_order_items_order_type_seq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT uq_order_items_order_type_seq UNIQUE (order_id, type, sequence_number);


--
-- Name: usage_event usage_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_event
    ADD CONSTRAINT usage_event_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: video_segments video_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_segments
    ADD CONSTRAINT video_segments_pkey PRIMARY KEY (id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: woof_pack_purchases woof_pack_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.woof_pack_purchases
    ADD CONSTRAINT woof_pack_purchases_pkey PRIMARY KEY (id);


--
-- Name: woof_packs woof_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.woof_packs
    ADD CONSTRAINT woof_packs_pkey PRIMARY KEY (id);


--
-- Name: woof_packs woof_packs_stripe_price_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.woof_packs
    ADD CONSTRAINT woof_packs_stripe_price_id_key UNIQUE (stripe_price_id);


--
-- Name: idx_affiliates_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliates_parent_id ON public.affiliates USING btree (parent_id);


--
-- Name: idx_alfie_cache_prompt_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_cache_prompt_hash ON public.alfie_cache USING btree (prompt_hash);


--
-- Name: idx_alfie_cache_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_cache_type ON public.alfie_cache USING btree (prompt_type);


--
-- Name: idx_alfie_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_conversations_user_id ON public.alfie_conversations USING btree (user_id);


--
-- Name: idx_alfie_messages_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_messages_asset_id ON public.alfie_messages USING btree (asset_id);


--
-- Name: idx_alfie_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_messages_conversation_id ON public.alfie_messages USING btree (conversation_id);


--
-- Name: idx_alfie_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_messages_created_at ON public.alfie_messages USING btree (created_at);


--
-- Name: idx_alfie_sessions_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_sessions_order_id ON public.alfie_conversation_sessions USING btree (order_id);


--
-- Name: idx_alfie_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alfie_sessions_user_id ON public.alfie_conversation_sessions USING btree (user_id);


--
-- Name: idx_assets_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_brand ON public.assets USING btree (brand_id);


--
-- Name: idx_assets_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_created ON public.assets USING btree (created_at DESC);


--
-- Name: idx_assets_job_set; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_job_set ON public.assets USING btree (job_set_id);


--
-- Name: idx_assets_jobset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_jobset ON public.assets USING btree (job_set_id, index_in_set, created_at);


--
-- Name: idx_batch_process; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_process ON public.batch_requests USING btree (process_after, status);


--
-- Name: idx_batch_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_user ON public.batch_requests USING btree (user_id);


--
-- Name: idx_brands_user_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brands_user_default ON public.brands USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_canva_designs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canva_designs_category ON public.canva_designs USING btree (category);


--
-- Name: idx_canva_designs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canva_designs_created_at ON public.canva_designs USING btree (created_at DESC);


--
-- Name: idx_chat_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_user ON public.chat_sessions USING btree (user_id, last_interaction DESC);


--
-- Name: idx_commissions_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_affiliate ON public.affiliate_commissions USING btree (affiliate_id);


--
-- Name: idx_commissions_conversion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_conversion ON public.affiliate_commissions USING btree (conversion_id);


--
-- Name: idx_contact_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_requests_created_at ON public.contact_requests USING btree (created_at DESC);


--
-- Name: idx_contact_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_requests_email ON public.contact_requests USING btree (email);


--
-- Name: idx_contact_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_requests_status ON public.contact_requests USING btree (status);


--
-- Name: idx_counters_monthly_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_counters_monthly_brand ON public.counters_monthly USING btree (brand_id, period_yyyymm DESC);


--
-- Name: idx_deliverable_brand_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliverable_brand_status ON public.deliverable USING btree (brand_id, status, created_at DESC);


--
-- Name: idx_deliverable_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliverable_updated ON public.deliverable USING btree (updated_at DESC);


--
-- Name: idx_generation_logs_brand_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generation_logs_brand_created ON public.generation_logs USING btree (brand_id, created_at DESC);


--
-- Name: idx_generation_logs_type_engine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generation_logs_type_engine ON public.generation_logs USING btree (type, engine) WHERE (status = 'success'::text);


--
-- Name: idx_generation_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generation_logs_user_created ON public.generation_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_idem_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idem_expires ON public.idempotency_keys USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_job_queue_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_idempotency_key ON public.job_queue USING btree (idempotency_key);


--
-- Name: idx_job_queue_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_order ON public.job_queue USING btree (order_id);


--
-- Name: idx_job_queue_payload; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_payload ON public.job_queue USING gin (payload);


--
-- Name: idx_job_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_status ON public.job_queue USING btree (status, created_at);


--
-- Name: idx_job_queue_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_queue_user ON public.job_queue USING btree (user_id);


--
-- Name: idx_job_sets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_sets_status ON public.job_sets USING btree (status, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));


--
-- Name: idx_job_sets_style_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_sets_style_ref ON public.job_sets USING btree (style_ref_asset_id);


--
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_status ON public.jobs USING btree (status, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));


--
-- Name: idx_library_assets_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_assets_brand_id ON public.library_assets USING btree (brand_id);


--
-- Name: idx_library_assets_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_assets_campaign ON public.library_assets USING btree (campaign);


--
-- Name: idx_library_assets_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_assets_order_id ON public.library_assets USING btree (order_id);


--
-- Name: idx_library_assets_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_assets_tags ON public.library_assets USING gin (tags);


--
-- Name: idx_library_assets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_library_assets_user_id ON public.library_assets USING btree (user_id);


--
-- Name: idx_media_generations_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_brand ON public.media_generations USING btree (brand_id) WHERE (brand_id IS NOT NULL);


--
-- Name: idx_media_generations_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_brand_id ON public.media_generations USING btree (brand_id);


--
-- Name: idx_media_generations_engine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_engine ON public.media_generations USING btree (engine);


--
-- Name: idx_media_generations_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_expires ON public.media_generations USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_media_generations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_expires_at ON public.media_generations USING btree (expires_at);


--
-- Name: idx_media_generations_expires_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_expires_status ON public.media_generations USING btree (expires_at, status) WHERE (status = 'completed'::text);


--
-- Name: idx_media_generations_user_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_generations_user_type_created ON public.media_generations USING btree (user_id, type, created_at DESC);


--
-- Name: idx_metrics_use_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_use_case ON public.provider_metrics USING btree (use_case, format);


--
-- Name: idx_news_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_created_at ON public.news USING btree (created_at DESC);


--
-- Name: idx_news_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_published ON public.news USING btree (published);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_status ON public.order_items USING btree (status);


--
-- Name: idx_orders_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_brand_id ON public.orders USING btree (brand_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_payment_sessions_email_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_sessions_email_verified ON public.payment_sessions USING btree (email, verified);


--
-- Name: idx_payment_sessions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_sessions_session_id ON public.payment_sessions USING btree (session_id);


--
-- Name: idx_payment_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_sessions_user_id ON public.payment_sessions USING btree (user_id);


--
-- Name: idx_payment_verification_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_verification_log_created_at ON public.payment_verification_log USING btree (created_at);


--
-- Name: idx_payment_verification_log_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_verification_log_session_id ON public.payment_verification_log USING btree (session_id);


--
-- Name: idx_profiles_active_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_active_brand ON public.profiles USING btree (active_brand_id);


--
-- Name: idx_usage_event_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_event_brand ON public.usage_event USING btree (brand_id, created_at DESC);


--
-- Name: idx_videos_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_expires_at ON public.videos USING btree (expires_at);


--
-- Name: idx_videos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_status ON public.videos USING btree (status);


--
-- Name: idx_videos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_videos_user_id ON public.videos USING btree (user_id);


--
-- Name: idx_woof_pack_purchases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_woof_pack_purchases_user_id ON public.woof_pack_purchases USING btree (user_id);


--
-- Name: ix_job_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_job_queue_created ON public.job_queue USING btree (created_at DESC);


--
-- Name: ix_job_queue_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_job_queue_status_created ON public.job_queue USING btree (status, created_at);


--
-- Name: ix_job_queue_status_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_job_queue_status_type ON public.job_queue USING btree (status, type) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));


--
-- Name: ix_job_queue_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_job_queue_user ON public.job_queue USING btree (user_id);


--
-- Name: ix_orders_user_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_user_brand ON public.orders USING btree (user_id, brand_id);


--
-- Name: ix_sessions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessions_order ON public.alfie_conversation_sessions USING btree (order_id);


--
-- Name: media_generations_modality_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_generations_modality_idx ON public.media_generations USING btree (modality);


--
-- Name: media_generations_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_generations_provider_idx ON public.media_generations USING btree (provider_id);


--
-- Name: providers_formats_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX providers_formats_idx ON public.providers USING gin (formats);


--
-- Name: providers_modalities_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX providers_modalities_idx ON public.providers USING gin (modalities);


--
-- Name: transactions_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_created_idx ON public.transactions USING btree (created_at DESC);


--
-- Name: transactions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_user_idx ON public.transactions USING btree (user_id);


--
-- Name: uq_job_queue_order_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_job_queue_order_type_status ON public.job_queue USING btree (order_id, type, status) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));


--
-- Name: uq_order_items_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_order_items_order_type ON public.order_items USING btree (order_id, type);


--
-- Name: profiles on_profile_plan_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_plan_change BEFORE UPDATE ON public.profiles FOR EACH ROW WHEN ((new.plan IS DISTINCT FROM old.plan)) EXECUTE FUNCTION public.sync_plan_quotas();


--
-- Name: generation_logs purge_old_logs_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER purge_old_logs_trigger AFTER INSERT ON public.generation_logs FOR EACH STATEMENT EXECUTE FUNCTION public.purge_old_generation_logs();


--
-- Name: job_queue trg_enqueue_render_jobs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enqueue_render_jobs AFTER UPDATE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.enqueue_render_jobs();


--
-- Name: job_queue trigger_enqueue_render_jobs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_enqueue_render_jobs AFTER UPDATE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.enqueue_render_jobs();


--
-- Name: profiles trigger_sync_brand_plan; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_brand_plan AFTER UPDATE OF plan ON public.profiles FOR EACH ROW WHEN ((old.plan IS DISTINCT FROM new.plan)) EXECUTE FUNCTION public.sync_brand_plan_with_profile();


--
-- Name: alfie_conversations update_alfie_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_alfie_conversations_updated_at BEFORE UPDATE ON public.alfie_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: alfie_conversation_sessions update_alfie_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_alfie_sessions_updated_at BEFORE UPDATE ON public.alfie_conversation_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: brands update_brands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: canva_designs update_canva_designs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_canva_designs_updated_at BEFORE UPDATE ON public.canva_designs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_requests update_contact_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_requests_updated_at BEFORE UPDATE ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deliverable update_deliverable_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deliverable_updated_at BEFORE UPDATE ON public.deliverable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: library_assets update_library_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_library_assets_updated_at BEFORE UPDATE ON public.library_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: media_generations update_media_generations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_media_generations_updated_at BEFORE UPDATE ON public.media_generations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: news update_news_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order_items update_order_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: videos update_videos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: affiliate_clicks affiliate_clicks_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_conversion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_conversion_id_fkey FOREIGN KEY (conversion_id) REFERENCES public.affiliate_conversions(id) ON DELETE CASCADE;


--
-- Name: affiliate_conversions affiliate_conversions_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_conversions
    ADD CONSTRAINT affiliate_conversions_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_payouts affiliate_payouts_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliates affiliates_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.affiliates(id) ON DELETE SET NULL;


--
-- Name: alfie_conversation_sessions alfie_conversation_sessions_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_conversation_sessions
    ADD CONSTRAINT alfie_conversation_sessions_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: alfie_conversation_sessions alfie_conversation_sessions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_conversation_sessions
    ADD CONSTRAINT alfie_conversation_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: alfie_conversation_sessions alfie_conversation_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_conversation_sessions
    ADD CONSTRAINT alfie_conversation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: alfie_conversations alfie_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_conversations
    ADD CONSTRAINT alfie_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: alfie_messages alfie_messages_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_messages
    ADD CONSTRAINT alfie_messages_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_generations(id) ON DELETE SET NULL;


--
-- Name: alfie_messages alfie_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alfie_messages
    ADD CONSTRAINT alfie_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.alfie_conversations(id) ON DELETE CASCADE;


--
-- Name: assets assets_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: assets assets_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: assets assets_job_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_job_set_id_fkey FOREIGN KEY (job_set_id) REFERENCES public.job_sets(id) ON DELETE CASCADE;


--
-- Name: batch_requests batch_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_requests
    ADD CONSTRAINT batch_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: brands brands_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: counters_monthly counters_monthly_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counters_monthly
    ADD CONSTRAINT counters_monthly_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: deliverable deliverable_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable
    ADD CONSTRAINT deliverable_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: generation_logs generation_logs_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_logs
    ADD CONSTRAINT generation_logs_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: generation_logs generation_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_logs
    ADD CONSTRAINT generation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_queue job_queue_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: job_queue job_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_sets job_sets_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_sets
    ADD CONSTRAINT job_sets_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: job_sets job_sets_style_ref_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_sets
    ADD CONSTRAINT job_sets_style_ref_asset_id_fkey FOREIGN KEY (style_ref_asset_id) REFERENCES public.media_generations(id);


--
-- Name: job_sets job_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_sets
    ADD CONSTRAINT job_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_job_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_job_set_id_fkey FOREIGN KEY (job_set_id) REFERENCES public.job_sets(id) ON DELETE CASCADE;


--
-- Name: library_assets library_assets_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_assets
    ADD CONSTRAINT library_assets_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: library_assets library_assets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_assets
    ADD CONSTRAINT library_assets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: library_assets library_assets_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_assets
    ADD CONSTRAINT library_assets_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE SET NULL;


--
-- Name: library_assets library_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_assets
    ADD CONSTRAINT library_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: media_generations media_generations_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_generations
    ADD CONSTRAINT media_generations_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: media_generations media_generations_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_generations
    ADD CONSTRAINT media_generations_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: media_generations media_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_generations
    ADD CONSTRAINT media_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: news news_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payment_sessions payment_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_active_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_active_brand_id_fkey FOREIGN KEY (active_brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: usage_event usage_event_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_event
    ADD CONSTRAINT usage_event_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: usage_event usage_event_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_event
    ADD CONSTRAINT usage_event_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverable(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: video_segments video_segments_parent_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_segments
    ADD CONSTRAINT video_segments_parent_video_id_fkey FOREIGN KEY (parent_video_id) REFERENCES public.media_generations(id) ON DELETE CASCADE;


--
-- Name: videos videos_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: videos videos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: woof_pack_purchases woof_pack_purchases_pack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.woof_pack_purchases
    ADD CONSTRAINT woof_pack_purchases_pack_id_fkey FOREIGN KEY (pack_id) REFERENCES public.woof_packs(id);


--
-- Name: woof_pack_purchases woof_pack_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.woof_pack_purchases
    ADD CONSTRAINT woof_pack_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: news Admins can create news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create news" ON public.news FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: news Admins can delete news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete news" ON public.news FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: news Admins can update news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update news" ON public.news FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: affiliates Admins can view all affiliates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all affiliates" ON public.affiliates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: affiliate_clicks Admins can view all clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all clicks" ON public.affiliate_clicks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: affiliate_commissions Admins can view all commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all commissions" ON public.affiliate_commissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contact_requests Admins can view all contact requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all contact requests" ON public.contact_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: affiliate_conversions Admins can view all conversions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all conversions" ON public.affiliate_conversions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: generation_logs Admins can view all generation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all generation logs" ON public.generation_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: news Admins can view all news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all news" ON public.news FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: affiliate_payouts Admins can view all payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all payouts" ON public.affiliate_payouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payment_verification_log Admins can view payment verification logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view payment verification logs" ON public.payment_verification_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: alfie_cache Anyone can read cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read cache" ON public.alfie_cache FOR SELECT USING (true);


--
-- Name: contact_requests Anyone can submit contact requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit contact requests" ON public.contact_requests FOR INSERT WITH CHECK (true);


--
-- Name: canva_designs Anyone can view canva designs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view canva designs" ON public.canva_designs FOR SELECT USING (true);


--
-- Name: credit_packs Anyone can view credit packs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view credit packs" ON public.credit_packs FOR SELECT USING (true);


--
-- Name: news Anyone can view published news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published news" ON public.news FOR SELECT USING ((published = true));


--
-- Name: woof_packs Anyone can view woof packs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view woof packs" ON public.woof_packs FOR SELECT USING ((active = true));


--
-- Name: affiliate_clicks Authenticated affiliates can view own clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated affiliates can view own clicks" ON public.affiliate_clicks FOR SELECT TO authenticated USING ((affiliate_id = auth.uid()));


--
-- Name: affiliate_commissions Authenticated affiliates can view own commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated affiliates can view own commissions" ON public.affiliate_commissions FOR SELECT TO authenticated USING ((affiliate_id = auth.uid()));


--
-- Name: affiliate_conversions Authenticated affiliates can view own conversions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated affiliates can view own conversions" ON public.affiliate_conversions FOR SELECT TO authenticated USING ((affiliate_id = auth.uid()));


--
-- Name: affiliates Authenticated affiliates can view own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated affiliates can view own data" ON public.affiliates FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: affiliate_payouts Authenticated affiliates can view own payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated affiliates can view own payouts" ON public.affiliate_payouts FOR SELECT TO authenticated USING ((affiliate_id = auth.uid()));


--
-- Name: canva_designs Authenticated users can insert canva designs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert canva designs" ON public.canva_designs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: profiles Enable insert for service role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for service role" ON public.profiles FOR INSERT WITH CHECK (true);


--
-- Name: affiliates Enable insert for service role on affiliates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for service role on affiliates" ON public.affiliates FOR INSERT WITH CHECK (true);


--
-- Name: plans_config Only admins can modify plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can modify plans" ON public.plans_config USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: providers Only admins can modify providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can modify providers" ON public.providers USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans_config Plans configuration publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Plans configuration publicly readable" ON public.plans_config FOR SELECT USING (true);


--
-- Name: providers Providers are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers are viewable by everyone" ON public.providers FOR SELECT USING (true);


--
-- Name: provider_metrics Public can read metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read metrics" ON public.provider_metrics FOR SELECT USING (true);


--
-- Name: jobs Service can insert jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert jobs" ON public.jobs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: usage_event Service can insert usage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert usage events" ON public.usage_event FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: job_queue Service can manage all jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage all jobs" ON public.job_queue USING (true);


--
-- Name: counters_monthly Service can manage counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage counters" ON public.counters_monthly USING ((auth.uid() IS NOT NULL));


--
-- Name: jobs Service can manage jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage jobs" ON public.jobs USING (true);


--
-- Name: jobs Service can update jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can update jobs" ON public.jobs FOR UPDATE USING ((auth.uid() IS NOT NULL));


--
-- Name: generation_logs Service role can insert generation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert generation logs" ON public.generation_logs FOR INSERT WITH CHECK (true);


--
-- Name: transactions Service role can insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert transactions" ON public.transactions FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: batch_requests Service role can manage all batch requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all batch requests" ON public.batch_requests USING ((auth.uid() IS NOT NULL));


--
-- Name: idempotency_keys Service role can manage idempotency; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage idempotency" ON public.idempotency_keys TO service_role USING (true) WITH CHECK (true);


--
-- Name: job_sets Service role can manage job_sets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage job_sets" ON public.job_sets TO service_role USING (true) WITH CHECK (true);


--
-- Name: alfie_cache Service role can write cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can write cache" ON public.alfie_cache USING ((auth.uid() IS NOT NULL));


--
-- Name: provider_metrics Service role can write metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can write metrics" ON public.provider_metrics USING ((auth.uid() IS NOT NULL));


--
-- Name: payment_sessions Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.payment_sessions USING (false);


--
-- Name: templates Templates are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Templates are viewable by everyone" ON public.templates FOR SELECT USING (true);


--
-- Name: library_assets Users can create library assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create library assets" ON public.library_assets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: alfie_messages Users can create messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create messages in their conversations" ON public.alfie_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.alfie_conversations
  WHERE ((alfie_conversations.id = alfie_messages.conversation_id) AND (alfie_conversations.user_id = auth.uid())))));


--
-- Name: order_items Users can create order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create order items" ON public.order_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: alfie_conversation_sessions Users can create their conversation sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their conversation sessions" ON public.alfie_conversation_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: alfie_conversations Users can create their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own conversations" ON public.alfie_conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: media_generations Users can create their own media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own media" ON public.media_generations FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: orders Users can create their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: videos Users can create their own videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own videos" ON public.videos FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: jobs Users can delete jobs from their job sets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete jobs from their job sets" ON public.jobs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.job_sets
  WHERE ((job_sets.id = jobs.job_set_id) AND (job_sets.user_id = auth.uid())))));


--
-- Name: alfie_messages Users can delete messages from their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete messages from their conversations" ON public.alfie_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.alfie_conversations
  WHERE ((alfie_conversations.id = alfie_messages.conversation_id) AND (alfie_conversations.user_id = auth.uid())))));


--
-- Name: brands Users can delete their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own brands" ON public.brands FOR DELETE USING (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: alfie_conversations Users can delete their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own conversations" ON public.alfie_conversations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: media_generations Users can delete their own media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own media" ON public.media_generations FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: posts Users can delete their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: videos Users can delete their own videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own videos" ON public.videos FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: batch_requests Users can insert batch requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert batch requests" ON public.batch_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: brands Users can insert their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own brands" ON public.brands FOR INSERT WITH CHECK (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: posts Users can insert their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: batch_requests Users can read own batch requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own batch requests" ON public.batch_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own basic info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own basic info" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK (((id = auth.uid()) AND (NOT (plan IS DISTINCT FROM ( SELECT profiles_1.plan
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (NOT (granted_by_admin IS DISTINCT FROM ( SELECT profiles_1.granted_by_admin
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (NOT (quota_visuals_per_month IS DISTINCT FROM ( SELECT profiles_1.quota_visuals_per_month
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (NOT (quota_brands IS DISTINCT FROM ( SELECT profiles_1.quota_brands
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (NOT (quota_videos IS DISTINCT FROM ( SELECT profiles_1.quota_videos
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (NOT (stripe_customer_id IS DISTINCT FROM ( SELECT profiles_1.stripe_customer_id
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (NOT (stripe_subscription_id IS DISTINCT FROM ( SELECT profiles_1.stripe_subscription_id
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))))));


--
-- Name: alfie_conversation_sessions Users can update their conversation sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their conversation sessions" ON public.alfie_conversation_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: library_assets Users can update their library assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their library assets" ON public.library_assets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: order_items Users can update their order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their order items" ON public.order_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: brands Users can update their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own brands" ON public.brands FOR UPDATE USING (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: alfie_conversations Users can update their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own conversations" ON public.alfie_conversations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: media_generations Users can update their own media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own media" ON public.media_generations FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: orders Users can update their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: posts Users can update their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: videos Users can update their own videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own videos" ON public.videos FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: media_generations Users can view all their media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all their media" ON public.media_generations FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: jobs Users can view jobs from their job sets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view jobs from their job sets" ON public.jobs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.job_sets
  WHERE ((job_sets.id = jobs.job_set_id) AND (job_sets.user_id = auth.uid())))));


--
-- Name: alfie_messages Users can view messages from their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages from their conversations" ON public.alfie_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.alfie_conversations
  WHERE ((alfie_conversations.id = alfie_messages.conversation_id) AND (alfie_conversations.user_id = auth.uid())))));


--
-- Name: counters_monthly Users can view own brand counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own brand counters" ON public.counters_monthly FOR SELECT USING ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid()))));


--
-- Name: job_sets Users can view own brand job sets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own brand job sets" ON public.job_sets FOR SELECT USING (((user_id = auth.uid()) AND (brand_id = ( SELECT profiles.active_brand_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: generation_logs Users can view own generation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own generation logs" ON public.generation_logs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: jobs Users can view own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.job_sets
  WHERE ((job_sets.id = jobs.job_set_id) AND (job_sets.user_id = auth.uid())))));


--
-- Name: credit_transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: usage_event Users can view own usage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own usage events" ON public.usage_event FOR SELECT USING ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid()))));


--
-- Name: video_segments Users can view segments of their videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view segments of their videos" ON public.video_segments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.media_generations
  WHERE ((media_generations.id = video_segments.parent_video_id) AND (media_generations.user_id = auth.uid())))));


--
-- Name: alfie_conversation_sessions Users can view their conversation sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their conversation sessions" ON public.alfie_conversation_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: library_assets Users can view their library assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their library assets" ON public.library_assets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: order_items Users can view their order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: brands Users can view their own brands; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own brands" ON public.brands FOR SELECT USING (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: alfie_conversations Users can view their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own conversations" ON public.alfie_conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: job_queue Users can view their own jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own jobs" ON public.job_queue FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: posts Users can view their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own posts" ON public.posts FOR SELECT USING (((user_id)::text = ( SELECT (auth.uid())::text AS uid)));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: videos Users can view their own videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own videos" ON public.videos FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: woof_pack_purchases Users can view their own woof pack purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own woof pack purchases" ON public.woof_pack_purchases FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: affiliate_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_conversions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

--
-- Name: alfie_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alfie_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: alfie_conversation_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alfie_conversation_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: alfie_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alfie_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: alfie_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alfie_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: assets assets_insert_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_insert_service ON public.assets FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: assets assets_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_select_admin ON public.assets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: assets assets_select_own_brand; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_select_own_brand ON public.assets FOR SELECT TO authenticated USING ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid()))));


--
-- Name: batch_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batch_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: canva_designs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canva_designs ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions chat_sessions_all_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sessions_all_own ON public.chat_sessions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: chat_sessions chat_sessions_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_sessions_select_admin ON public.chat_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contact_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: counters_monthly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.counters_monthly ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_packs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: deliverable; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deliverable ENABLE ROW LEVEL SECURITY;

--
-- Name: deliverable deliverable_delete_own_brand; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliverable_delete_own_brand ON public.deliverable FOR DELETE TO authenticated USING ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid()))));


--
-- Name: deliverable deliverable_insert_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliverable_insert_service ON public.deliverable FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: deliverable deliverable_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliverable_select_admin ON public.deliverable FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: deliverable deliverable_select_own_brand; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliverable_select_own_brand ON public.deliverable FOR SELECT TO authenticated USING ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid()))));


--
-- Name: deliverable deliverable_update_own_brand; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliverable_update_own_brand ON public.deliverable FOR UPDATE TO authenticated USING ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid())))) WITH CHECK ((brand_id IN ( SELECT brands.id
   FROM public.brands
  WHERE (brands.user_id = auth.uid()))));


--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags feature_flags_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feature_flags_read_all ON public.feature_flags FOR SELECT TO authenticated USING (true);


--
-- Name: feature_flags feature_flags_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feature_flags_write_admin ON public.feature_flags TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: generation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: job_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: job_sets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_sets ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: library_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.library_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: media_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: news; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_verification_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_verification_log ENABLE ROW LEVEL SECURITY;

--
-- Name: plans_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans_config ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_metrics provider_metrics_read_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY provider_metrics_read_authenticated ON public.provider_metrics FOR SELECT TO authenticated USING (true);


--
-- Name: providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

--
-- Name: providers providers_read_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY providers_read_authenticated ON public.providers FOR SELECT TO authenticated USING (true);


--
-- Name: job_queue service_role_manages_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_manages_jobs ON public.job_queue TO service_role USING (true) WITH CHECK (true);


--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_event; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_event ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: job_queue users_view_own_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_view_own_jobs ON public.job_queue FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: video_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

--
-- Name: woof_pack_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.woof_pack_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: woof_packs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.woof_packs ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


