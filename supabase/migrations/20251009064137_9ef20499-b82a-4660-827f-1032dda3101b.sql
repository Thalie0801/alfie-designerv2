-- Ajouter les champs manquants à la table jobs pour le suivi d'état
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 1;

-- Ajouter les champs manquants à media_generations pour le système de bibliothèque
ALTER TABLE media_generations 
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS is_source_upload BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);

-- Créer un index pour améliorer les performances de recherche dans la bibliothèque
CREATE INDEX IF NOT EXISTS idx_media_generations_user_type_created 
  ON media_generations(user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_generations_brand 
  ON media_generations(brand_id) WHERE brand_id IS NOT NULL;

-- Créer une table pour les segments vidéo temporaires (montage Sora)
CREATE TABLE IF NOT EXISTS video_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_video_id UUID REFERENCES media_generations(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  segment_url TEXT NOT NULL,
  duration_seconds INTEGER,
  is_temporary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour video_segments
ALTER TABLE video_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view segments of their videos"
  ON video_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM media_generations
      WHERE media_generations.id = video_segments.parent_video_id
      AND media_generations.user_id = auth.uid()
    )
  );

-- Fonction pour générer un ID de job court (ex: JOB-7F2A)
CREATE OR REPLACE FUNCTION generate_short_job_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'JOB-';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Ajouter un champ short_id à la table jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Créer un trigger pour générer automatiquement le short_id
CREATE OR REPLACE FUNCTION set_job_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := generate_short_job_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_job_short_id ON jobs;
CREATE TRIGGER trigger_set_job_short_id
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_job_short_id();