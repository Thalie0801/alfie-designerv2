-- Add unique constraint to prevent payment session replay attacks
ALTER TABLE payment_sessions 
  ADD CONSTRAINT payment_sessions_session_id_unique UNIQUE (session_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_sessions_session_id ON payment_sessions(session_id);

-- Add logging table for payment verification attempts
CREATE TABLE IF NOT EXISTS payment_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'duplicate', 'fraud', 'error')),
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_verification_log_session_id ON payment_verification_log(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_verification_log_created_at ON payment_verification_log(created_at);

-- Enable RLS on logging table
ALTER TABLE payment_verification_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view verification logs
CREATE POLICY "Admins can view payment verification logs"
ON payment_verification_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);