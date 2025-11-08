-- Improve media_generations lookups by user and creation date
CREATE INDEX IF NOT EXISTS idx_media_generations_user_created_at
  ON public.media_generations (user_id, created_at DESC);
