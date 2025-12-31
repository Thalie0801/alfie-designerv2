-- Phase 1: Étendre job_queue et créer table deliveries

-- Ajouter les colonnes manquantes à job_queue pour supporter JobSpecV1
ALTER TABLE job_queue 
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS brandkit_id uuid REFERENCES brands(id),
  ADD COLUMN IF NOT EXISTS character_anchor_id uuid REFERENCES identity_anchors(id),
  ADD COLUMN IF NOT EXISTS spec_json jsonb DEFAULT '{}'::jsonb;

-- Créer table deliveries pour centraliser les livrables
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES job_queue(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- 'master_9x16', 'variant_1x1', 'variant_16x9', 'thumb_1', 'thumb_2', 'thumb_3', 'cover', 'zip'
  url text,
  meta_json jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour les deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_job_id ON deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Enable RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view deliveries for their jobs
CREATE POLICY "Users can view their job deliveries" 
ON deliveries FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM job_queue jq 
  WHERE jq.id = deliveries.job_id 
  AND jq.user_id = auth.uid()
));

-- RLS: Service role can manage deliveries
CREATE POLICY "Service role manages deliveries" 
ON deliveries FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Trigger pour updated_at
CREATE OR REPLACE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrer les jobs existants avec kind basé sur type
UPDATE job_queue SET kind = CASE
  WHEN type = 'generate_video' THEN 'multi_clip_video'
  WHEN type = 'render_carousels' THEN 'carousel'
  WHEN type = 'render_images' THEN 'single_image'
  ELSE type
END WHERE kind IS NULL;