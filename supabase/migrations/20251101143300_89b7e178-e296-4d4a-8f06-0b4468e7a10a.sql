-- Add metadata column to jobs table for carousel coherence
ALTER TABLE jobs
  ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;