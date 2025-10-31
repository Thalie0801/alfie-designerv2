-- Phase 1 + Phase 2: Nouvelles tables pour Alfie Designer

-- Table provider_metrics (bandit UCB)
CREATE TABLE IF NOT EXISTS provider_metrics (
  provider_id TEXT NOT NULL,
  use_case TEXT NOT NULL,
  format TEXT NOT NULL,
  trials INT DEFAULT 0,
  successes INT DEFAULT 0,
  total_reward NUMERIC DEFAULT 0,
  avg_reward NUMERIC GENERATED ALWAYS AS (
    CASE WHEN trials > 0 THEN total_reward / trials ELSE 0 END
  ) STORED,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (provider_id, use_case, format)
);

CREATE INDEX IF NOT EXISTS idx_metrics_use_case ON provider_metrics(use_case, format);

-- RLS : lecture publique, écriture service_role
ALTER TABLE provider_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read metrics"
  ON provider_metrics FOR SELECT
  USING (true);

CREATE POLICY "Service role can write metrics"
  ON provider_metrics FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Table batch_requests (batch nocturne)
CREATE TABLE IF NOT EXISTS batch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  modality TEXT CHECK (modality IN ('image','video')) NOT NULL,
  payload_json JSONB NOT NULL,
  process_after TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','canceled')),
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_user ON batch_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_process ON batch_requests(process_after, status);

-- RLS : lecture/écriture par owner
ALTER TABLE batch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own batch requests"
  ON batch_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert batch requests"
  ON batch_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all batch requests"
  ON batch_requests FOR ALL
  USING (auth.uid() IS NOT NULL);