-- Phase 1: Refonte V1 - Tables & Functions

-- Table counters_monthly (compteurs mensuels par marque)
CREATE TABLE IF NOT EXISTS counters_monthly (
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  period_yyyymm INT NOT NULL,
  images_used INT NOT NULL DEFAULT 0,
  reels_used INT NOT NULL DEFAULT 0,
  woofs_used INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brand_id, period_yyyymm)
);

-- Table deliverable (livrables unifiés)
CREATE TABLE IF NOT EXISTS deliverable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('image','carousel','reel')),
  objective TEXT,
  style_choice TEXT CHECK (style_choice IN ('template_canva','ia')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preview','processing','completed','failed')),
  preview_url TEXT,
  canva_link TEXT,
  zip_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table usage_event (audit & KPI)
CREATE TABLE IF NOT EXISTS usage_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES deliverable(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image_ai','carousel_ai_image','reel_export','premium_t2v')),
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_counters_monthly_brand ON counters_monthly(brand_id, period_yyyymm DESC);
CREATE INDEX IF NOT EXISTS idx_deliverable_brand_status ON deliverable(brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_event_brand ON usage_event(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverable_updated ON deliverable(updated_at DESC);

-- RLS policies
ALTER TABLE counters_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_event ENABLE ROW LEVEL SECURITY;

-- Policies counters_monthly
CREATE POLICY "Users can view own brand counters"
  ON counters_monthly FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Service can manage counters"
  ON counters_monthly FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policies deliverable
CREATE POLICY "Users can view own deliverables"
  ON deliverable FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own deliverables"
  ON deliverable FOR INSERT
  WITH CHECK (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own deliverables"
  ON deliverable FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own deliverables"
  ON deliverable FOR DELETE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- Policies usage_event
CREATE POLICY "Users can view own usage events"
  ON usage_event FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Service can insert usage events"
  ON usage_event FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fonction pour incrémenter les compteurs mensuels atomiquement
CREATE OR REPLACE FUNCTION increment_monthly_counters(
  p_brand_id UUID,
  p_period_yyyymm INT,
  p_images INT DEFAULT 0,
  p_reels INT DEFAULT 0,
  p_woofs INT DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO counters_monthly (brand_id, period_yyyymm, images_used, reels_used, woofs_used)
  VALUES (p_brand_id, p_period_yyyymm, p_images, p_reels, p_woofs)
  ON CONFLICT (brand_id, period_yyyymm)
  DO UPDATE SET
    images_used = counters_monthly.images_used + EXCLUDED.images_used,
    reels_used = counters_monthly.reels_used + EXCLUDED.reels_used,
    woofs_used = counters_monthly.woofs_used + EXCLUDED.woofs_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pour updated_at sur deliverable
CREATE TRIGGER update_deliverable_updated_at
  BEFORE UPDATE ON deliverable
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();