-- Ensure media_generations table exists with required constraints and policies
CREATE TABLE IF NOT EXISTS public.media_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  brand_id UUID REFERENCES public.brands(id),
  type TEXT NOT NULL CHECK (type IN ('image', 'carousel', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'expired')
  ),
  output_url TEXT,
  thumbnail_url TEXT,
  prompt TEXT,
  engine TEXT,
  woofs INTEGER DEFAULT 0,
  metadata JSONB,
  job_id TEXT,
  is_source_upload BOOLEAN DEFAULT FALSE,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes for Studio dashboards and generation lookups
CREATE INDEX IF NOT EXISTS idx_media_generations_user_id
  ON public.media_generations(user_id);

CREATE INDEX IF NOT EXISTS idx_media_generations_brand_id
  ON public.media_generations(brand_id);

CREATE INDEX IF NOT EXISTS idx_media_generations_created_at
  ON public.media_generations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_generations_status
  ON public.media_generations(status);

-- Align RLS with application level expectations
ALTER TABLE public.media_generations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_generations'
      AND policyname = 'Users can view their own media'
  ) THEN
    CREATE POLICY "Users can view their own media"
      ON public.media_generations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_generations'
      AND policyname = 'Users can insert their own media'
  ) THEN
    CREATE POLICY "Users can insert their own media"
      ON public.media_generations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_generations'
      AND policyname = 'Users can update their own media'
  ) THEN
    CREATE POLICY "Users can update their own media"
      ON public.media_generations FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_generations'
      AND policyname = 'Users can delete their own media'
  ) THEN
    CREATE POLICY "Users can delete their own media"
      ON public.media_generations FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Ensure brands table is available for Studio features
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro', 'studio')),
  quota_images INTEGER NOT NULL DEFAULT 150,
  quota_videos INTEGER NOT NULL DEFAULT 15,
  quota_woofs INTEGER NOT NULL DEFAULT 15,
  images_used INTEGER NOT NULL DEFAULT 0,
  videos_used INTEGER NOT NULL DEFAULT 0,
  woofs_used INTEGER NOT NULL DEFAULT 0,
  brand_kit JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brands'
      AND policyname = 'Users can manage their brands'
  ) THEN
    CREATE POLICY "Users can manage their brands"
      ON public.brands FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Guarantee at least one default brand for the primary Studio user
INSERT INTO public.brands (user_id, name, plan)
SELECT 'ad9cdf92-36b4-4064-8379-2cca7533d1d4', 'Ma Première Marque', 'starter'
WHERE NOT EXISTS (
  SELECT 1 FROM public.brands
  WHERE user_id = 'ad9cdf92-36b4-4064-8379-2cca7533d1d4'
);

-- Attempt to relax statement timeout where permitted to avoid 57014 errors
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER DATABASE postgres SET statement_timeout = ''60s''';
  EXCEPTION
    WHEN insufficient_privilege OR undefined_object THEN
      NULL; -- Ignore when the role is not allowed to change database level settings
  END;
END
$$;

