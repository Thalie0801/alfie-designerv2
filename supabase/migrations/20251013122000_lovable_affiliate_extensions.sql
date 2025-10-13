-- Ensure affiliate referral tracking columns exist
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS rate_bps INTEGER DEFAULT 1000;

-- Create affiliate attributions table if needed
CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (affiliate_id, user_id)
);

ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_attributions' AND policyname = 'Service role can insert attributions'
  ) THEN
    CREATE POLICY "Service role can insert attributions"
      ON public.affiliate_attributions
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_attributions' AND policyname = 'Affiliates view their attributions'
  ) THEN
    CREATE POLICY "Affiliates view their attributions"
      ON public.affiliate_attributions
      FOR SELECT
      USING (affiliate_id IN (
        SELECT id FROM public.affiliates WHERE email = (auth.jwt()->>'email')
      ));
  END IF;
END $$;

-- Extend payouts table for attribution tracking
ALTER TABLE public.affiliate_payouts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan TEXT,
  ALTER COLUMN status SET DEFAULT 'due';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_payouts' AND policyname = 'Service role can insert payouts'
  ) THEN
    CREATE POLICY "Service role can insert payouts"
      ON public.affiliate_payouts
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
