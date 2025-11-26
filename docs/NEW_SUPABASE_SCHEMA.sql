-- =====================================================
-- NOUVEAU PROJET SUPABASE - SCHÉMA COMPLET
-- Alfie Designer - Clean Start (Sans media_generations)
-- =====================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  quota_visuals_per_month INTEGER DEFAULT 0,
  quota_brands INTEGER DEFAULT 1,
  quota_videos INTEGER DEFAULT 0,
  quota_woofs INTEGER DEFAULT 0,
  visuals_used INTEGER DEFAULT 0,
  active_brand_id UUID,
  granted_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. BRANDS TABLE
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  palette JSONB DEFAULT '[]'::jsonb,
  logo_url TEXT,
  fonts JSONB,
  voice TEXT,
  niche TEXT,
  canva_connected BOOLEAN DEFAULT FALSE,
  images_used INTEGER DEFAULT 0,
  carousels_used INTEGER DEFAULT 0,
  reels_used INTEGER DEFAULT 0,
  woofs_used INTEGER DEFAULT 0,
  quota_visuals_per_month INTEGER DEFAULT 10,
  quota_videos INTEGER DEFAULT 0,
  quota_woofs INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brands"
  ON public.brands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brands"
  ON public.brands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands"
  ON public.brands FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands"
  ON public.brands FOR DELETE
  USING (auth.uid() = user_id);

-- 5. JOB QUEUE TABLE
CREATE TABLE public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  job_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON public.job_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all jobs"
  ON public.job_queue FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE INDEX idx_job_queue_status ON public.job_queue(status);
CREATE INDEX idx_job_queue_user_id ON public.job_queue(user_id);
CREATE INDEX idx_job_queue_brand_id ON public.job_queue(brand_id);
CREATE INDEX idx_job_queue_kind ON public.job_queue(kind);

-- View for active jobs
CREATE VIEW public.v_job_queue_active AS
SELECT id, user_id, brand_id, kind, status, payload, result, error, 
       attempts, max_attempts, is_archived, archived_at, job_version,
       created_at, claimed_at, completed_at
FROM public.job_queue
WHERE is_archived = FALSE OR is_archived IS NULL;

-- 6. LIBRARY ASSETS TABLE
CREATE TABLE public.library_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.job_queue(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL,
  cloudinary_public_id TEXT,
  cloudinary_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  slide_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.library_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets"
  ON public.library_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets"
  ON public.library_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_library_assets_user_id ON public.library_assets(user_id);
CREATE INDEX idx_library_assets_brand_id ON public.library_assets(brand_id);
CREATE INDEX idx_library_assets_created_at ON public.library_assets(created_at DESC);

-- 7. ORDERS TABLE
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  brief JSONB,
  plan JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT orders_status_check CHECK (status IN ('draft', 'brief_collection', 'text_generation', 'visual_generation', 'rendering', 'queued', 'completed', 'failed'))
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

-- 8. COUNTERS MONTHLY TABLE
CREATE TABLE public.counters_monthly (
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  period_yyyymm INTEGER NOT NULL,
  images_used INTEGER DEFAULT 0,
  reels_used INTEGER DEFAULT 0,
  woofs_used INTEGER DEFAULT 0,
  PRIMARY KEY (brand_id, period_yyyymm)
);

ALTER TABLE public.counters_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own counters"
  ON public.counters_monthly FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.id = counters_monthly.brand_id
    AND brands.user_id = auth.uid()
  ));

-- 9. JOB SETS TABLE
CREATE TABLE public.job_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.job_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own job sets"
  ON public.job_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all job sets"
  ON public.job_sets FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 10. IDEMPOTENCY KEYS TABLE
CREATE TABLE public.idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage idempotency keys"
  ON public.idempotency_keys FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 11. AFFILIATES TABLE
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  level INTEGER DEFAULT 1,
  total_referrals INTEGER DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  commission_earned DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affiliate"
  ON public.affiliates FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_affiliates_code ON public.affiliates(code);
CREATE INDEX idx_affiliates_parent_id ON public.affiliates(parent_id);

-- 12. AFFILIATE CONVERSIONS TABLE
CREATE TABLE public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  customer_email TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  commission DECIMAL(10,2) NOT NULL,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage conversions"
  ON public.affiliate_conversions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 13. PAYMENT SESSIONS TABLE
CREATE TABLE public.payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT UNIQUE NOT NULL,
  affiliate_ref UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment sessions"
  ON public.payment_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- 14. CLAIM NEXT JOB FUNCTION
CREATE OR REPLACE FUNCTION public.claim_next_job(worker_id TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  brand_id UUID,
  kind TEXT,
  status TEXT,
  payload JSONB,
  attempts INTEGER,
  max_attempts INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_job_id UUID;
BEGIN
  UPDATE public.job_queue
  SET status = 'processing',
      claimed_at = NOW(),
      attempts = attempts + 1
  WHERE id = (
    SELECT jq.id
    FROM public.job_queue jq
    WHERE jq.status = 'pending'
      AND (jq.is_archived = FALSE OR jq.is_archived IS NULL)
      AND jq.attempts < jq.max_attempts
    ORDER BY jq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO claimed_job_id;

  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jq.id, jq.user_id, jq.brand_id, jq.kind, jq.status, jq.payload, jq.attempts, jq.max_attempts, jq.created_at
  FROM public.job_queue jq
  WHERE jq.id = claimed_job_id;
END;
$$;

-- 15. UPDATE AFFILIATE STATUS FUNCTION
CREATE OR REPLACE FUNCTION public.update_affiliate_status(affiliate_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  child_count INTEGER;
  new_level INTEGER;
  new_status TEXT;
BEGIN
  SELECT COUNT(*) INTO child_count
  FROM public.affiliates
  WHERE parent_id = affiliate_id_param;

  IF child_count >= 10 THEN
    new_level := 3;
    new_status := 'diamond';
  ELSIF child_count >= 5 THEN
    new_level := 2;
    new_status := 'gold';
  ELSE
    new_level := 1;
    new_status := 'active';
  END IF;

  UPDATE public.affiliates
  SET level = new_level,
      status = new_status,
      total_referrals = child_count
  WHERE id = affiliate_id_param;
END;
$$;

-- 16. TRIGGER FOR PROFILES UPDATED_AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 17. TRIGGER FOR AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 18. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.library_assets;

-- =====================================================
-- FIN DU SCHÉMA
-- =====================================================
