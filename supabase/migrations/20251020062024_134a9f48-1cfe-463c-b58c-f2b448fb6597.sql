-- Table de configuration des plans
CREATE TABLE IF NOT EXISTS plans_config (
  plan TEXT PRIMARY KEY CHECK (plan IN ('starter', 'pro', 'studio')),
  woofs_per_month INT NOT NULL,
  visuals_per_month INT NOT NULL,
  durations TEXT NOT NULL, -- Format JSON: ["8", "15", "30", "60"]
  storage_days INT NOT NULL,
  price_eur INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des plans par défaut
INSERT INTO plans_config (plan, woofs_per_month, visuals_per_month, durations, storage_days, price_eur)
VALUES 
  ('starter', 15, 150, '["8"]', 30, 39),
  ('pro', 45, 450, '["8","15"]', 30, 99),
  ('studio', 100, 1000, '["8","15","30","60"]', 90, 199)
ON CONFLICT (plan) DO UPDATE SET
  woofs_per_month = EXCLUDED.woofs_per_month,
  visuals_per_month = EXCLUDED.visuals_per_month,
  durations = EXCLUDED.durations,
  storage_days = EXCLUDED.storage_days,
  price_eur = EXCLUDED.price_eur;

-- Table des crédits utilisateurs (simplifiée car on utilise déjà profiles)
-- On va plutôt ajouter les colonnes manquantes à profiles si nécessaire

-- Table des vidéos
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  duration INT NOT NULL CHECK (duration IN (8, 15, 30, 60)),
  ratio TEXT NOT NULL DEFAULT '16:9',
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'rendering', 'completed', 'failed')),
  video_url TEXT,
  thumbnail_url TEXT,
  assets JSONB DEFAULT '[]'::jsonb, -- Liste des URLs d'images utilisées
  tts_config JSONB, -- Configuration TTS si utilisée
  error_message TEXT,
  rendering_started_at TIMESTAMPTZ,
  rendering_completed_at TIMESTAMPTZ,
  file_size_bytes INT,
  woofs_cost INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_expires_at ON videos(expires_at);

-- RLS pour videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own videos"
ON videos FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own videos"
ON videos FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own videos"
ON videos FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own videos"
ON videos FOR DELETE
USING (user_id = auth.uid());

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour calculer les Woofs selon la durée
CREATE OR REPLACE FUNCTION calculate_woofs_cost(duration_seconds INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
BEGIN
  IF duration_seconds <= 8 THEN
    RETURN 1;
  ELSIF duration_seconds <= 15 THEN
    RETURN 2;
  ELSIF duration_seconds <= 30 THEN
    RETURN 4;
  ELSIF duration_seconds <= 60 THEN
    RETURN 8;
  ELSE
    RETURN 8; -- Par défaut pour durées > 60s
  END IF;
END;
$$;

-- Fonction pour vérifier si un utilisateur peut créer une vidéo
CREATE OR REPLACE FUNCTION can_create_video(
  user_id_param UUID,
  duration_seconds INT
)
RETURNS TABLE(
  can_create BOOLEAN,
  reason TEXT,
  woofs_available INT,
  woofs_needed INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  woofs_cost INT;
  allowed_durations TEXT;
BEGIN
  -- Récupérer le profil utilisateur
  SELECT * INTO user_profile FROM profiles WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User profile not found', 0, 0;
    RETURN;
  END IF;
  
  -- Vérifier si l'utilisateur a un plan actif
  IF user_profile.plan IS NULL OR user_profile.plan = 'none' THEN
    RETURN QUERY SELECT false, 'No active plan', 0, 0;
    RETURN;
  END IF;
  
  -- Calculer le coût en Woofs
  woofs_cost := calculate_woofs_cost(duration_seconds);
  
  -- Récupérer les durées autorisées pour ce plan
  SELECT durations INTO allowed_durations 
  FROM plans_config 
  WHERE plan = user_profile.plan;
  
  -- Vérifier si la durée est autorisée
  IF NOT (allowed_durations::jsonb ? duration_seconds::text) THEN
    RETURN QUERY SELECT 
      false, 
      'Duration not allowed for your plan', 
      COALESCE(user_profile.quota_videos, 0) - COALESCE(user_profile.woofs_consumed_this_month, 0),
      woofs_cost;
    RETURN;
  END IF;
  
  -- Vérifier si l'utilisateur a assez de Woofs
  IF COALESCE(user_profile.woofs_consumed_this_month, 0) + woofs_cost > COALESCE(user_profile.quota_videos, 0) THEN
    RETURN QUERY SELECT 
      false, 
      'Insufficient Woofs', 
      COALESCE(user_profile.quota_videos, 0) - COALESCE(user_profile.woofs_consumed_this_month, 0),
      woofs_cost;
    RETURN;
  END IF;
  
  -- Tout est OK
  RETURN QUERY SELECT 
    true, 
    'OK', 
    COALESCE(user_profile.quota_videos, 0) - COALESCE(user_profile.woofs_consumed_this_month, 0),
    woofs_cost;
END;
$$;

-- Fonction pour consommer des Woofs lors de la création d'une vidéo
CREATE OR REPLACE FUNCTION consume_woofs(
  user_id_param UUID,
  woofs_amount INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET woofs_consumed_this_month = COALESCE(woofs_consumed_this_month, 0) + woofs_amount
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- Fonction pour rembourser des Woofs en cas d'échec
CREATE OR REPLACE FUNCTION refund_woofs(
  user_id_param UUID,
  woofs_amount INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET woofs_consumed_this_month = GREATEST(0, COALESCE(woofs_consumed_this_month, 0) - woofs_amount)
  WHERE id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- Table pour les packs de Woofs additionnels
CREATE TABLE IF NOT EXISTS woof_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  woofs INT NOT NULL,
  price_eur INT NOT NULL,
  stripe_price_id TEXT UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des packs par défaut
INSERT INTO woof_packs (name, woofs, price_eur)
VALUES 
  ('Pack 50 Woofs', 50, 99),
  ('Pack 100 Woofs', 100, 179)
ON CONFLICT DO NOTHING;

-- RLS pour woof_packs (lecture publique)
ALTER TABLE woof_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view woof packs"
ON woof_packs FOR SELECT
USING (active = true);

-- Table pour l'historique des achats de packs
CREATE TABLE IF NOT EXISTS woof_pack_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES woof_packs(id),
  woofs INT NOT NULL,
  price_eur INT NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_woof_pack_purchases_user_id ON woof_pack_purchases(user_id);

ALTER TABLE woof_pack_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own woof pack purchases"
ON woof_pack_purchases FOR SELECT
USING (user_id = auth.uid());