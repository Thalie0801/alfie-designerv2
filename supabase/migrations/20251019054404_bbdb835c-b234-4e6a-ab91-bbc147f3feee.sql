-- Create index on media_generations for faster asset queries
CREATE INDEX IF NOT EXISTS idx_media_generations_user_type_created 
ON media_generations(user_id, type, created_at DESC);

-- Create index for expiry cleanup queries
CREATE INDEX IF NOT EXISTS idx_media_generations_expires 
ON media_generations(expires_at) 
WHERE expires_at IS NOT NULL;