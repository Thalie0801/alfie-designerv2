-- Add carousel coherence columns to job_sets
ALTER TABLE job_sets
  ADD COLUMN master_seed TEXT,
  ADD COLUMN style_ref_asset_id UUID REFERENCES media_generations(id),
  ADD COLUMN constraints JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_job_sets_style_ref ON job_sets(style_ref_asset_id);