-- Create email_events table for tracking delivery status from Brevo webhooks
CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_queue_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  template TEXT,
  event_type TEXT NOT NULL, -- delivered, bounced, opened, clicked, spam, blocked
  provider TEXT NOT NULL DEFAULT 'brevo',
  provider_message_id TEXT,
  raw_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX idx_email_events_to_email ON public.email_events(to_email);
CREATE INDEX idx_email_events_message_id ON public.email_events(provider_message_id);
CREATE INDEX idx_email_events_created_at ON public.email_events(created_at);

-- Add provider_message_id column to email_queue for tracking
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access (service role)
CREATE POLICY "Service role full access on email_events"
ON public.email_events
FOR ALL
USING (true)
WITH CHECK (true);