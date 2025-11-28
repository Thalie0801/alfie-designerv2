-- Add ambassadeur role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ambassadeur';

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, badge)
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Users can view their own badges
CREATE POLICY "Users can view their own badges"
ON public.user_badges FOR SELECT
USING (user_id = auth.uid());

-- Service role can manage badges
CREATE POLICY "Service role can manage badges"
ON public.user_badges FOR ALL
USING (true)
WITH CHECK (true);