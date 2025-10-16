-- ==========================================
-- ALFIE DESIGNER - Configuration des Plans
-- ==========================================

-- 1. Table des plans disponibles
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  billing_period TEXT DEFAULT 'monthly', -- monthly, yearly
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insérer les plans selon ton UI
INSERT INTO plans (name, slug, description, price, features, limits, is_popular, display_order) VALUES
(
  'Starter', 
  'starter', 
  'Pour débuter avec Alfie Designer', 
  29.00,
  '["1 marque", "20 visuels/mois", "2 templates", "Support email"]'::jsonb,
  '{"brands": 1, "visuals_per_month": 20, "templates": 2}'::jsonb,
  false,
  1
),
(
  'Pro', 
  'pro', 
  'Le plus populaire pour les créateurs', 
  79.00,
  '["3 marques", "100 visuels/mois", "4 templates + Reels", "Support prioritaire"]'::jsonb,
  '{"brands": 3, "visuals_per_month": 100, "templates": 4, "reels": true}'::jsonb,
  true,
  2
),
(
  'Studio', 
  'studio', 
  'Pour les studios et agences', 
  149.00,
  '["Multi-marques", "1000 visuels/mois", "Reels avancés", "Analytics"]'::jsonb,
  '{"brands": -1, "visuals_per_month": 1000, "reels": true, "analytics": true}'::jsonb,
  false,
  3
),
(
  'Enterprise', 
  'enterprise', 
  'Solution complète pour entreprises', 
  299.00,
  '["Tout illimité", "API & SSO", "White-label", "Support dédié"]'::jsonb,
  '{"brands": -1, "visuals_per_month": -1, "api_access": true, "sso": true, "white_label": true}'::jsonb,
  false,
  4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_popular = EXCLUDED.is_popular;

-- 3. Table des abonnements utilisateurs
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'past_due')),
  
  -- Informations de période
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Informations de paiement (Stripe, etc.)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- 4. Table pour suivre l'usage (quotas)
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Compteurs d'usage
  visuals_created INTEGER DEFAULT 0,
  brands_count INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, period_start)
);

-- 5. Index pour performances
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_period ON user_usage(period_start, period_end);

-- 6. Fonction pour créer un abonnement Starter par défaut
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer l'abonnement Starter pour chaque nouvel utilisateur
  INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_end)
  SELECT 
    NEW.id, 
    plans.id, 
    'trial',
    NOW() + INTERVAL '14 days' -- 14 jours d'essai
  FROM plans
  WHERE plans.slug = 'starter'
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Créer l'entrée d'usage pour le mois en cours
  INSERT INTO user_usage (user_id, period_start, period_end)
  VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (user_id, period_start) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger sur la création d'utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();

-- 8. Fonction pour vérifier les quotas
CREATE OR REPLACE FUNCTION check_user_quota(
  p_user_id UUID,
  p_quota_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_limits JSONB;
  v_current_usage INTEGER;
  v_max_allowed INTEGER;
BEGIN
  -- Récupérer les limites du plan actuel
  SELECT p.limits INTO v_plan_limits
  FROM user_subscriptions us
  JOIN plans p ON p.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active';
  
  IF NOT FOUND THEN
    RETURN FALSE; -- Pas d'abonnement actif
  END IF;
  
  -- Récupérer la limite pour ce type de quota
  v_max_allowed := (v_plan_limits->>p_quota_type)::INTEGER;
  
  -- -1 signifie illimité
  IF v_max_allowed = -1 THEN
    RETURN TRUE;
  END IF;
  
  -- Récupérer l'usage actuel
  IF p_quota_type = 'visuals_per_month' THEN
    SELECT visuals_created INTO v_current_usage
    FROM user_usage
    WHERE user_id = p_user_id
      AND period_start <= NOW()
      AND period_end > NOW();
  ELSIF p_quota_type = 'brands' THEN
    SELECT brands_count INTO v_current_usage
    FROM user_usage
    WHERE user_id = p_user_id
      AND period_start <= NOW()
      AND period_end > NOW();
  END IF;
  
  -- Vérifier si on dépasse la limite
  RETURN (COALESCE(v_current_usage, 0) + p_increment) <= v_max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Row Level Security (RLS)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Plans : lisibles par tous
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON plans;
CREATE POLICY "Plans are viewable by everyone"
  ON plans FOR SELECT
  USING (true);

-- Subscriptions : lecture pour l'utilisateur concerné
DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Usage : lecture pour l'utilisateur concerné
DROP POLICY IF EXISTS "Users can view their own usage" ON user_usage;
CREATE POLICY "Users can view their own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

-- 10. Vue pratique pour récupérer l'abonnement complet
CREATE OR REPLACE VIEW user_subscription_details AS
SELECT 
  us.id,
  us.user_id,
  us.status,
  us.trial_ends_at,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  p.id as plan_id,
  p.name as plan_name,
  p.slug as plan_slug,
  p.price,
  p.features,
  p.limits,
  uu.visuals_created,
  uu.brands_count
FROM user_subscriptions us
JOIN plans p ON p.id = us.plan_id
LEFT JOIN user_usage uu ON uu.user_id = us.user_id 
  AND uu.period_start <= NOW() 
  AND uu.period_end > NOW();

-- Permettre la lecture de la vue
GRANT SELECT ON user_subscription_details TO authenticated;

-- ==========================================
-- Configuration terminée ! ✅
-- ==========================================
