-- Créer la table feature_flags pour gérer les fonctionnalités par rôle/plan
CREATE TABLE IF NOT EXISTS public.feature_flags (
  feature TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  allowed_plans TEXT[] DEFAULT '{}',
  allowed_roles TEXT[] DEFAULT '{admin,vip}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: tout le monde peut lire les feature flags
CREATE POLICY "feature_flags_read_all"
ON public.feature_flags FOR SELECT
TO authenticated
USING (true);

-- Policy: seuls les admins peuvent modifier les feature flags
CREATE POLICY "feature_flags_write_admin"
ON public.feature_flags FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Données initiales: nouvelles fonctionnalités disponibles pour VIP/Admin uniquement
INSERT INTO public.feature_flags (feature, enabled, allowed_roles, allowed_plans) VALUES
  ('new_generator', true, '{admin,vip}', '{}'),
  ('providers_ui', true, '{admin,vip}', '{}'),
  ('quota_panel', true, '{admin,vip}', '{}'),
  ('video_router', true, '{admin,vip}', '{}'),
  ('image_router', true, '{admin,vip}', '{}')
ON CONFLICT (feature) DO NOTHING;