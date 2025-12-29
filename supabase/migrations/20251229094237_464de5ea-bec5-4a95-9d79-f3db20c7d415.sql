-- =====================================================
-- VIDEO BATCHES MODULE - Complete Schema
-- =====================================================

-- 1) video_batches: Un batch = 1 prompt utilisateur → N vidéos
CREATE TABLE IF NOT EXISTS video_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  input_prompt TEXT NOT NULL,
  settings JSONB DEFAULT '{}',  -- { ratio, language, videos_count, sfx_transition, style_lock }
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) batch_videos: Chaque vidéo contient EXACTEMENT 3 clips
CREATE TABLE IF NOT EXISTS batch_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES video_batches(id) ON DELETE CASCADE,
  video_index INT NOT NULL CHECK (video_index >= 1),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) batch_clips: 3 clips par vidéo (anchor image + animation Veo)
CREATE TABLE IF NOT EXISTS batch_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES batch_videos(id) ON DELETE CASCADE,
  clip_index INT NOT NULL CHECK (clip_index BETWEEN 1 AND 3),
  anchor_prompt TEXT,        -- Prompt pour Nano Banana Pro (image)
  veo_prompt TEXT,           -- Prompt anti-storyboard pour Veo 3.1
  anchor_url TEXT,           -- URL Cloudinary de l'image anchor
  anchor_public_id TEXT,     -- Public ID Cloudinary
  clip_url TEXT,             -- URL Cloudinary du MP4
  clip_public_id TEXT,       -- Public ID Cloudinary
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  error TEXT,
  duration_seconds INT NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) batch_video_texts: Textes overlay par clip + caption/CTA
CREATE TABLE IF NOT EXISTS batch_video_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES batch_videos(id) ON DELETE CASCADE,
  clip1_title TEXT,
  clip1_subtitle TEXT,
  clip2_title TEXT,
  clip2_subtitle TEXT,
  clip3_title TEXT,
  clip3_subtitle TEXT,
  caption TEXT,              -- Caption complète (pas dans CSV, dans ZIP)
  cta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE video_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_video_texts ENABLE ROW LEVEL SECURITY;

-- video_batches policies
CREATE POLICY "Users can view their own batches"
  ON video_batches FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own batches"
  ON video_batches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own batches"
  ON video_batches FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own batches"
  ON video_batches FOR DELETE
  USING (user_id = auth.uid());

-- batch_videos policies (via batch ownership)
CREATE POLICY "Users can view their batch videos"
  ON batch_videos FOR SELECT
  USING (batch_id IN (SELECT id FROM video_batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can create batch videos"
  ON batch_videos FOR INSERT
  WITH CHECK (batch_id IN (SELECT id FROM video_batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can update batch videos"
  ON batch_videos FOR UPDATE
  USING (batch_id IN (SELECT id FROM video_batches WHERE user_id = auth.uid()));

-- batch_clips policies (via video -> batch ownership)
CREATE POLICY "Users can view their batch clips"
  ON batch_clips FOR SELECT
  USING (video_id IN (
    SELECT bv.id FROM batch_videos bv
    JOIN video_batches vb ON vb.id = bv.batch_id
    WHERE vb.user_id = auth.uid()
  ));

CREATE POLICY "Users can create batch clips"
  ON batch_clips FOR INSERT
  WITH CHECK (video_id IN (
    SELECT bv.id FROM batch_videos bv
    JOIN video_batches vb ON vb.id = bv.batch_id
    WHERE vb.user_id = auth.uid()
  ));

CREATE POLICY "Users can update batch clips"
  ON batch_clips FOR UPDATE
  USING (video_id IN (
    SELECT bv.id FROM batch_videos bv
    JOIN video_batches vb ON vb.id = bv.batch_id
    WHERE vb.user_id = auth.uid()
  ));

-- batch_video_texts policies (via video -> batch ownership)
CREATE POLICY "Users can view their video texts"
  ON batch_video_texts FOR SELECT
  USING (video_id IN (
    SELECT bv.id FROM batch_videos bv
    JOIN video_batches vb ON vb.id = bv.batch_id
    WHERE vb.user_id = auth.uid()
  ));

CREATE POLICY "Users can create video texts"
  ON batch_video_texts FOR INSERT
  WITH CHECK (video_id IN (
    SELECT bv.id FROM batch_videos bv
    JOIN video_batches vb ON vb.id = bv.batch_id
    WHERE vb.user_id = auth.uid()
  ));

CREATE POLICY "Users can update video texts"
  ON batch_video_texts FOR UPDATE
  USING (video_id IN (
    SELECT bv.id FROM batch_videos bv
    JOIN video_batches vb ON vb.id = bv.batch_id
    WHERE vb.user_id = auth.uid()
  ));

-- =====================================================
-- Indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_video_batches_user_id ON video_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_video_batches_status ON video_batches(status);
CREATE INDEX IF NOT EXISTS idx_batch_videos_batch_id ON batch_videos(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_clips_video_id ON batch_clips(video_id);
CREATE INDEX IF NOT EXISTS idx_batch_clips_status ON batch_clips(status);
CREATE INDEX IF NOT EXISTS idx_batch_video_texts_video_id ON batch_video_texts(video_id);

-- =====================================================
-- Enable Realtime
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE video_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE batch_videos;
ALTER PUBLICATION supabase_realtime ADD TABLE batch_clips;