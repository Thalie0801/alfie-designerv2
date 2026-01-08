-- Add recovery_token column to leads table for pack recovery links
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS recovery_token TEXT UNIQUE DEFAULT NULL;

-- Create index for fast lookup by token
CREATE INDEX IF NOT EXISTS leads_recovery_token_idx ON leads(recovery_token);