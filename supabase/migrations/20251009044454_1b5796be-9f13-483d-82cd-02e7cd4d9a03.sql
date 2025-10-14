-- Créer les enums pour plan et engine
CREATE TYPE public.plan_type AS ENUM ('starter', 'pro', 'studio');
CREATE TYPE public.asset_engine AS ENUM ('nano', 'sora', 'veo3');

-- Ajouter les colonnes de plan et quotas à la table brands
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS plan public.plan_type DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quota_images integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_videos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_woofs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS images_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS videos_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS woofs_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resets_on date DEFAULT (date_trunc('month', now() + interval '1 month'))::date,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Migrer les données existantes: copier le plan du profile vers la brand active
UPDATE public.brands b
SET 
  plan = CASE 
    WHEN p.plan = 'starter' THEN 'starter'::plan_type
    WHEN p.plan = 'pro' THEN 'pro'::plan_type
    WHEN p.plan = 'studio' THEN 'studio'::plan_type
    ELSE NULL
  END,
  quota_images = CASE 
    WHEN p.plan = 'starter' THEN 150
    WHEN p.plan = 'pro' THEN 450
    WHEN p.plan = 'studio' THEN 1000
    ELSE 0
  END,
  quota_videos = CASE 
    WHEN p.plan = 'starter' THEN 15
    WHEN p.plan = 'pro' THEN 45
    WHEN p.plan = 'studio' THEN 100
    ELSE 0
  END,
  quota_woofs = CASE 
    WHEN p.plan = 'starter' THEN 15
    WHEN p.plan = 'pro' THEN 45
    WHEN p.plan = 'studio' THEN 100
    ELSE 0
  END,
  images_used = COALESCE(p.generations_this_month, 0),
  videos_used = COALESCE(p.videos_this_month, 0),
  woofs_used = COALESCE(p.woofs_consumed_this_month, 0),
  stripe_subscription_id = p.stripe_subscription_id
FROM public.profiles p
WHERE b.user_id = p.id 
  AND p.active_brand_id = b.id
  AND b.plan IS NULL;

-- Ajouter les colonnes à media_generations pour en faire des assets
ALTER TABLE public.media_generations
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engine public.asset_engine,
  ADD COLUMN IF NOT EXISTS woofs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + interval '30 days');

-- Mettre à jour les assets existants avec le brand_id actif de l'utilisateur
UPDATE public.media_generations mg
SET brand_id = p.active_brand_id
FROM public.profiles p
WHERE mg.user_id = p.id 
  AND mg.brand_id IS NULL
  AND p.active_brand_id IS NOT NULL;

-- Ajouter un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_media_generations_brand_id ON public.media_generations(brand_id);
CREATE INDEX IF NOT EXISTS idx_media_generations_expires_at ON public.media_generations(expires_at);

-- Commentaires
COMMENT ON COLUMN public.brands.plan IS '1 plan = 1 marque avec quotas dédiés';
COMMENT ON COLUMN public.brands.quota_images IS 'Quota mensuel d''images (150/450/1000 selon plan)';
COMMENT ON COLUMN public.brands.quota_videos IS 'Quota mensuel de vidéos (15/45/100 selon plan)';
COMMENT ON COLUMN public.brands.quota_woofs IS 'Quota mensuel de Woofs (15/45/100, Sora=1, Veo3=4)';
COMMENT ON COLUMN public.brands.images_used IS 'Images générées ce mois';
COMMENT ON COLUMN public.brands.videos_used IS 'Vidéos générées ce mois';
COMMENT ON COLUMN public.brands.woofs_used IS 'Woofs consommés ce mois (Sora=1, Veo3=4)';
COMMENT ON COLUMN public.brands.resets_on IS 'Date de reset des compteurs (1er du mois)';
COMMENT ON COLUMN public.media_generations.brand_id IS 'Marque propriétaire de l''asset';
COMMENT ON COLUMN public.media_generations.engine IS 'Moteur utilisé: nano (image), sora (vidéo 1 Woof), veo3 (vidéo 4 Woofs)';
COMMENT ON COLUMN public.media_generations.woofs IS 'Coût en Woofs: 0 pour image, 1 pour Sora, 4 pour Veo3';
COMMENT ON COLUMN public.media_generations.expires_at IS 'Date d''expiration (30 jours après création)';