-- Add anti-abuse columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS generation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_generation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ip_address TEXT;