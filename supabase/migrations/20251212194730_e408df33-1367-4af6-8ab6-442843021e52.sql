-- Table leads pour capturer les emails
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT DEFAULT 'start_game',
  intent JSONB DEFAULT '{}'::jsonb,
  marketing_opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_unique ON public.leads (lower(email));

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policies for leads
CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can manage leads" ON public.leads FOR ALL USING (auth.uid() IS NOT NULL);

-- Table email_queue pour l'automatisation
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_queue_run_idx ON public.email_queue (status, run_after);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can manage email queue
CREATE POLICY "Service role manages email queue" ON public.email_queue FOR ALL USING (true);

-- Add columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS canva_url TEXT,
ADD COLUMN IF NOT EXISTS zip_url TEXT,
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id);

-- Function to enqueue delivery email when order is delivered
CREATE OR REPLACE FUNCTION public.enqueue_delivery_email()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.customer_email IS NOT NULL) THEN
    -- Email de livraison immédiat
    INSERT INTO public.email_queue (to_email, template, payload, run_after)
    VALUES (
      NEW.customer_email,
      'delivery_ready',
      jsonb_build_object(
        'order_id', NEW.id,
        'canva_url', NEW.canva_url,
        'zip_url', NEW.zip_url
      ),
      now()
    );
    -- Relance +2h
    INSERT INTO public.email_queue (to_email, template, payload, run_after)
    VALUES (
      NEW.customer_email,
      'reminder_2h',
      jsonb_build_object('order_id', NEW.id),
      now() + interval '2 hours'
    );
    -- Relance +24h
    INSERT INTO public.email_queue (to_email, template, payload, run_after)
    VALUES (
      NEW.customer_email,
      'reminder_24h',
      jsonb_build_object('order_id', NEW.id),
      now() + interval '24 hours'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trg_enqueue_delivery_email ON public.orders;
CREATE TRIGGER trg_enqueue_delivery_email
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_delivery_email();