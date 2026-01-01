-- Subject Packs table for storing reusable subject references (1-3 images)
CREATE TABLE IF NOT EXISTS subject_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  name text NOT NULL,
  pack_type text NOT NULL DEFAULT 'person' CHECK (pack_type IN ('person', 'mascot', 'product', 'object')),
  master_image_url text NOT NULL,
  anchor_a_url text,
  anchor_b_url text,
  identity_prompt text DEFAULT '',
  negative_prompt text DEFAULT '',
  constraints_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subject_packs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_packs
CREATE POLICY "Users can view their subject packs"
ON subject_packs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their subject packs"
ON subject_packs FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their subject packs"
ON subject_packs FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their subject packs"
ON subject_packs FOR DELETE
USING (user_id = auth.uid());

-- Add default_subject_pack_id to brands
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS default_subject_pack_id uuid REFERENCES subject_packs(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_subject_packs_updated_at
BEFORE UPDATE ON subject_packs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE subject_packs;