-- Create table to track processed payment sessions for idempotency
CREATE TABLE IF NOT EXISTS public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  processed_at timestamptz NOT NULL DEFAULT now(),
  plan text NOT NULL,
  amount numeric,
  CONSTRAINT valid_plan CHECK (plan IN ('starter', 'pro', 'studio', 'enterprise'))
);

-- Enable RLS
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only" ON public.payment_sessions
USING (false);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_sessions_session_id ON public.payment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_user_id ON public.payment_sessions(user_id);

-- Update verify-payment to insert into this table
COMMENT ON TABLE public.payment_sessions IS 'Tracks processed Stripe checkout sessions to prevent duplicate processing';
