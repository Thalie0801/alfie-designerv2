-- ============================================================================
-- PHASE 1 : Table assets (source de vérité unique pour tous les médias)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_set_id uuid REFERENCES public.job_sets(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  mime text NOT NULL DEFAULT 'image/png',
  width integer,
  height integer,
  checksum text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour les queries fréquentes (avec IF NOT EXISTS via DO block)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_job_set') THEN
    CREATE INDEX idx_assets_job_set ON public.assets(job_set_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_brand') THEN
    CREATE INDEX idx_assets_brand ON public.assets(brand_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_created') THEN
    CREATE INDEX idx_assets_created ON public.assets(created_at DESC);
  END IF;
END $$;

-- RLS : utilisateur peut voir assets de ses brands
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assets from their brands" ON public.assets;
CREATE POLICY "Users can view assets from their brands"
  ON public.assets FOR SELECT
  USING (brand_id IN (
    SELECT id FROM public.brands WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Service can insert assets" ON public.assets;
CREATE POLICY "Service can insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Enable Realtime pour recevoir les INSERT en temps réel
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

-- ============================================================================
-- PHASE 2 : Vue unifiée pour compatibilité /library
-- ============================================================================

CREATE OR REPLACE VIEW v_unified_assets AS
SELECT
  id,
  brand_id,
  meta->>'public_url' AS output_url,
  (meta->>'job_set_id')::uuid AS job_set_id,
  mime AS type,
  meta,
  created_at
FROM public.assets
UNION ALL
SELECT
  id,
  brand_id,
  output_url,
  (metadata->>'job_set_id')::uuid AS job_set_id,
  type,
  metadata AS meta,
  created_at
FROM public.media_generations
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets WHERE assets.id = media_generations.id
);