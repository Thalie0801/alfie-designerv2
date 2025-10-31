-- Table providers (registre moteurs IA)
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  modalities TEXT[] NOT NULL,
  formats TEXT[] NOT NULL,
  strengths TEXT[] NOT NULL,
  cost_json JSONB NOT NULL,
  quality_score NUMERIC NOT NULL DEFAULT 0.8,
  avg_latency_s INT NOT NULL DEFAULT 60,
  fail_rate NUMERIC NOT NULL DEFAULT 0.03,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS providers_modalities_idx ON providers USING GIN (modalities);
CREATE INDEX IF NOT EXISTS providers_formats_idx ON providers USING GIN (formats);

-- Étendre media_generations pour servir de renders
ALTER TABLE media_generations
  ADD COLUMN IF NOT EXISTS modality TEXT CHECK (modality IN ('image','video')),
  ADD COLUMN IF NOT EXISTS provider_id TEXT REFERENCES providers(id),
  ADD COLUMN IF NOT EXISTS params_json JSONB,
  ADD COLUMN IF NOT EXISTS brand_score INT CHECK (brand_score >= 0 AND brand_score <= 100),
  ADD COLUMN IF NOT EXISTS cost_woofs INT,
  ADD COLUMN IF NOT EXISTS render_url TEXT,
  ADD COLUMN IF NOT EXISTS error_json JSONB;

CREATE INDEX IF NOT EXISTS media_generations_provider_idx ON media_generations(provider_id);
CREATE INDEX IF NOT EXISTS media_generations_modality_idx ON media_generations(modality);

-- Table transactions (audit woofs)
CREATE TABLE IF NOT EXISTS transactions (
  tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta_woofs INT NOT NULL,
  reason TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON transactions(created_at DESC);

-- Seed providers initiaux
INSERT INTO providers (id, family, modalities, formats, strengths, cost_json, quality_score, avg_latency_s, fail_rate, enabled) VALUES
  ('gemini_image', 'google', ARRAY['image'], ARRAY['1024x1024','1080x1080','1200x628','1080x1920'], ARRAY['product','ad','typography'], '{"base_per_image":1,"hi_res_multiplier":1.5}'::jsonb, 0.8, 8, 0.02, true),
  ('veo3', 'higgsfield', ARRAY['video'], ARRAY['1080x1920','1080x1080','1920x1080','3840x2160'], ARRAY['reels','ads','motion_fast'], '{"1080p_per_5s":2,"4k_per_5s":5}'::jsonb, 0.78, 55, 0.03, true),
  ('sora2', 'higgsfield', ARRAY['video'], ARRAY['1920x1080','3840x2160'], ARRAY['cinematic','story','camera_moves'], '{"1080p_per_5s":4,"4k_per_5s":9}'::jsonb, 0.9, 140, 0.07, true),
  ('flux-lite', 'higgsfield', ARRAY['video'], ARRAY['1080x1920','1920x1080'], ARRAY['draft_fast','exploration'], '{"1080p_per_5s":1}'::jsonb, 0.65, 25, 0.06, true),
  ('img2video', 'higgsfield', ARRAY['video'], ARRAY['1080x1920','1080x1080'], ARRAY['animate_still'], '{"1080p_per_5s":2}'::jsonb, 0.75, 40, 0.04, true),
  ('cinema-xl', 'higgsfield', ARRAY['video'], ARRAY['1920x1080','3840x2160'], ARRAY['storytelling','effects'], '{"1080p_per_5s":3,"4k_per_5s":7}'::jsonb, 0.82, 90, 0.04, true),
  ('product-spin', 'higgsfield', ARRAY['video'], ARRAY['1080x1080','1920x1080'], ARRAY['product','ecommerce'], '{"1080p_per_5s":2}'::jsonb, 0.79, 45, 0.03, true),
  ('talking-head', 'higgsfield', ARRAY['video'], ARRAY['1080x1920','1920x1080'], ARRAY['avatar','voiceover'], '{"1080p_per_5s":2}'::jsonb, 0.76, 60, 0.05, true),
  ('loop-seamless', 'higgsfield', ARRAY['video'], ARRAY['1080x1080','1920x1080'], ARRAY['loop','banner'], '{"1080p_per_5s":2}'::jsonb, 0.74, 50, 0.04, true),
  ('product-shot', 'higgsfield', ARRAY['image'], ARRAY['1080x1080','2048x2048'], ARRAY['packshot','shadows'], '{"base_per_image":1.5}'::jsonb, 0.83, 12, 0.03, true),
  ('style-transfer', 'higgsfield', ARRAY['image'], ARRAY['1024x1024','2048x2048'], ARRAY['style','harmonize'], '{"base_per_image":1}'::jsonb, 0.77, 10, 0.04, true),
  ('img-upscale', 'higgsfield', ARRAY['image'], ARRAY['2048x2048','3840x2160'], ARRAY['upscale','enhance'], '{"base_per_image":0.75}'::jsonb, 0.81, 6, 0.02, true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies pour providers
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers are viewable by everyone"
  ON providers FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify providers"
  ON providers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies pour transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);