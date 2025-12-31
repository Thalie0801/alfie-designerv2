-- ================================================
-- VIDEO PIPELINE V2 - Tables fondation
-- ================================================

-- 1. Table job_steps : suivi granulaire des étapes
CREATE TABLE public.job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_queue(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL, -- gen_keyframe, animate_clip, voiceover, music, mix_audio, concat_clips, deliver
  step_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, queued, running, completed, failed, skipped
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  input_json JSONB DEFAULT '{}',
  output_json JSONB DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_steps_job_id ON job_steps(job_id);
CREATE INDEX idx_job_steps_status ON job_steps(status);
CREATE INDEX idx_job_steps_queued ON job_steps(status, created_at) WHERE status = 'queued';

ALTER TABLE job_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages job_steps" ON job_steps FOR ALL USING (true);

-- 2. Table identity_anchors : cohérence personnages/produits
CREATE TABLE public.identity_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  anchor_type TEXT NOT NULL DEFAULT 'character', -- character, product, set
  ref_image_url TEXT NOT NULL,
  constraints_json JSONB DEFAULT '{}', -- face_lock, outfit_lock, palette_lock, camera_angle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_identity_anchors_user ON identity_anchors(user_id);
CREATE INDEX idx_identity_anchors_brand ON identity_anchors(brand_id);

ALTER TABLE identity_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their anchors" ON identity_anchors FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their anchors" ON identity_anchors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their anchors" ON identity_anchors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their anchors" ON identity_anchors FOR DELETE USING (user_id = auth.uid());

-- 3. Table job_events : timeline realtime
CREATE TABLE public.job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_queue(id) ON DELETE CASCADE,
  step_id UUID REFERENCES job_steps(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- step_queued, step_started, step_completed, step_failed, job_completed
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_events_job_id ON job_events(job_id);
CREATE INDEX idx_job_events_created ON job_events(created_at DESC);

ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their job events" ON job_events FOR SELECT 
  USING (EXISTS (SELECT 1 FROM job_queue jq WHERE jq.id = job_events.job_id AND jq.user_id = auth.uid()));

-- Enable realtime for job_events
ALTER PUBLICATION supabase_realtime ADD TABLE job_events;

-- 4. Function pour claim un step (atomique)
CREATE OR REPLACE FUNCTION public.claim_next_step(p_job_id UUID DEFAULT NULL)
RETURNS TABLE(
  step_id UUID,
  job_id UUID,
  step_type TEXT,
  step_index INTEGER,
  input_json JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT js.id
    FROM job_steps js
    WHERE js.status = 'queued'
      AND (p_job_id IS NULL OR js.job_id = p_job_id)
    ORDER BY js.job_id, js.step_index
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_steps js
  SET 
    status = 'running',
    started_at = now(),
    attempt = attempt + 1,
    updated_at = now()
  FROM claimed
  WHERE js.id = claimed.id
  RETURNING js.id AS step_id, js.job_id, js.step_type, js.step_index, js.input_json;
END;
$$;

-- 5. Function pour marquer un step completed et queue le suivant
CREATE OR REPLACE FUNCTION public.complete_step_and_queue_next(
  p_step_id UUID,
  p_output_json JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_id UUID;
  v_step_index INTEGER;
  v_next_step_id UUID;
BEGIN
  -- Marquer le step comme completed
  UPDATE job_steps
  SET 
    status = 'completed',
    output_json = p_output_json,
    ended_at = now(),
    updated_at = now()
  WHERE id = p_step_id
  RETURNING job_id, step_index INTO v_job_id, v_step_index;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Trouver et queue le step suivant
  SELECT id INTO v_next_step_id
  FROM job_steps
  WHERE job_id = v_job_id
    AND step_index = v_step_index + 1
    AND status = 'pending';

  IF v_next_step_id IS NOT NULL THEN
    UPDATE job_steps SET status = 'queued', updated_at = now() WHERE id = v_next_step_id;
  ELSE
    -- Vérifier si tous les steps sont completed → marquer le job completed
    IF NOT EXISTS (SELECT 1 FROM job_steps WHERE job_id = v_job_id AND status NOT IN ('completed', 'skipped')) THEN
      UPDATE job_queue SET status = 'completed', finished_at = now(), updated_at = now() WHERE id = v_job_id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- 6. Function pour fail un step avec retry
CREATE OR REPLACE FUNCTION public.fail_step(
  p_step_id UUID,
  p_error TEXT
)
RETURNS TEXT -- 'retrying' | 'failed'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempt INTEGER;
  v_max_attempts INTEGER;
  v_result TEXT;
BEGIN
  SELECT attempt, max_attempts INTO v_attempt, v_max_attempts
  FROM job_steps WHERE id = p_step_id;

  IF v_attempt < v_max_attempts THEN
    -- Retry: remettre en queued
    UPDATE job_steps
    SET 
      status = 'queued',
      error = p_error,
      ended_at = now(),
      updated_at = now()
    WHERE id = p_step_id;
    v_result := 'retrying';
  ELSE
    -- Max retries atteint: failed définitivement
    UPDATE job_steps
    SET 
      status = 'failed',
      error = p_error,
      ended_at = now(),
      updated_at = now()
    WHERE id = p_step_id;
    
    -- Marquer le job parent comme failed aussi
    UPDATE job_queue jq
    SET status = 'failed', error = 'Step failed: ' || p_error, updated_at = now()
    FROM job_steps js
    WHERE js.id = p_step_id AND jq.id = js.job_id;
    
    v_result := 'failed';
  END IF;

  RETURN v_result;
END;
$$;