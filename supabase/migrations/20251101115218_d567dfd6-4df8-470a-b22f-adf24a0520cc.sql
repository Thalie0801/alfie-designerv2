-- ============================================================
-- CLEANUP (drop existing partial tables if any)
-- ============================================================
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS job_sets CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;

DROP FUNCTION IF EXISTS reserve_brand_quotas CASCADE;
DROP FUNCTION IF EXISTS refund_brand_quotas CASCADE;

-- ============================================================
-- CREATE TABLES
-- ============================================================

-- 1. Idempotency keys
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('pending','applied','failed')),
  result_ref TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_idem_expires ON idempotency_keys(expires_at) WHERE status = 'pending';

-- 2. Job sets
CREATE TABLE job_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  request_text TEXT NOT NULL,
  total INT NOT NULL CHECK (total >= 1 AND total <= 10),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','partial','done','failed','canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_sets_status ON job_sets(status, created_at) WHERE status IN ('queued','running');

-- 3. Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_set_id UUID NOT NULL REFERENCES job_sets(id) ON DELETE CASCADE,
  index_in_set INT NOT NULL CHECK (index_in_set >= 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  prompt TEXT NOT NULL,
  brand_snapshot JSONB NOT NULL,
  asset_id UUID,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_set_id, index_in_set)
);

CREATE INDEX idx_jobs_status ON jobs(status, created_at) WHERE status IN ('queued','running');

-- 4. Chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_interaction TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, brand_id)
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, last_interaction DESC);

-- ============================================================
-- CREATE FUNCTIONS
-- ============================================================

CREATE FUNCTION reserve_brand_quotas(
  p_brand_id UUID,
  p_visuals_count INT DEFAULT 0,
  p_reels_count INT DEFAULT 0,
  p_woofs_count INT DEFAULT 0
) RETURNS TABLE(success BOOLEAN, reason TEXT) AS $$
DECLARE
  v_quota_ok BOOLEAN;
BEGIN
  PERFORM * FROM brands WHERE id = p_brand_id FOR UPDATE;
  
  SELECT 
    (images_used + p_visuals_count <= quota_images) AND
    (videos_used + p_reels_count <= quota_videos) AND
    (woofs_used + p_woofs_count <= quota_woofs)
  INTO v_quota_ok
  FROM brands
  WHERE id = p_brand_id;
  
  IF NOT v_quota_ok THEN
    RETURN QUERY SELECT false, 'Quota exceeded'::TEXT;
    RETURN;
  END IF;
  
  UPDATE brands
  SET
    images_used = images_used + p_visuals_count,
    videos_used = videos_used + p_reels_count,
    woofs_used = woofs_used + p_woofs_count,
    updated_at = now()
  WHERE id = p_brand_id;
  
  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION refund_brand_quotas(
  p_brand_id UUID,
  p_visuals_count INT DEFAULT 0,
  p_reels_count INT DEFAULT 0,
  p_woofs_count INT DEFAULT 0
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE brands
  SET
    images_used = GREATEST(0, images_used - p_visuals_count),
    videos_used = GREATEST(0, videos_used - p_reels_count),
    woofs_used = GREATEST(0, woofs_used - p_woofs_count),
    updated_at = now()
  WHERE id = p_brand_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage idempotency" ON idempotency_keys FOR ALL USING (true);

ALTER TABLE job_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own job sets" ON job_sets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service can manage job_sets" ON job_sets FOR ALL USING (true);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM job_sets WHERE job_sets.id = jobs.job_set_id AND job_sets.user_id = auth.uid())
);
CREATE POLICY "Service can manage jobs" ON jobs FOR ALL USING (true);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON chat_sessions FOR ALL USING (user_id = auth.uid());