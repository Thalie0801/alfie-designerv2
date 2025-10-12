-- Plans & Brands
CREATE TABLE IF NOT EXISTS brand (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('Starter','Pro','Studio')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compteurs mensuels (par marque)
CREATE TABLE IF NOT EXISTS counters_monthly (
  brand_id UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  period_yyyymm INT NOT NULL,
  images_used INT NOT NULL DEFAULT 0,
  reels_used INT NOT NULL DEFAULT 0,
  woofs_used INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brand_id, period_yyyymm)
);

-- Livrables
CREATE TABLE IF NOT EXISTS deliverable (
  id UUID PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('image','carousel','reel')),
  objective TEXT,
  style_choice TEXT CHECK (style_choice IN ('template_canva','ia')),
  status TEXT NOT NULL DEFAULT 'pending',
  preview_url TEXT,
  canva_link TEXT,
  zip_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Événements d'usage (pour audit & KPI)
CREATE TABLE IF NOT EXISTS usage_event (
  id UUID PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES deliverable(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image_ai','carousel_ai_image','reel_export','premium_t2v')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rétention (ex: via policy côté storage/TTL job)
-- À implémenter côté workers en s'appuyant sur storage_policies.json
