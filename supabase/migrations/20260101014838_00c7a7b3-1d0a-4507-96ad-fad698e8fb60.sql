-- Add is_intermediate column to track keyframes and other intermediate assets
ALTER TABLE media_generations 
ADD COLUMN IF NOT EXISTS is_intermediate boolean DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_media_generations_intermediate 
ON media_generations(is_intermediate) 
WHERE is_intermediate = false;