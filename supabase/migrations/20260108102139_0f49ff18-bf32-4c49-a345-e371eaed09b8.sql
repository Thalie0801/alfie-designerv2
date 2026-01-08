-- Add generated_assets column to leads table for storing free pack assets
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS generated_assets JSONB DEFAULT NULL;

COMMENT ON COLUMN leads.generated_assets IS 'Array of generated free pack assets [{title, ratio, url, thumbnailUrl}]';