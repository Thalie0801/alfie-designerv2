-- Table pour les commandes upsell 30 visuels
CREATE TABLE public.upsell_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  brand_id UUID REFERENCES brands(id),
  session_id TEXT UNIQUE NOT NULL,
  email TEXT,
  product TEXT NOT NULL DEFAULT 'visuels_30',
  amount NUMERIC NOT NULL DEFAULT 19,
  status TEXT NOT NULL DEFAULT 'pending',
  total_visuals INTEGER DEFAULT 30,
  generated_count INTEGER DEFAULT 0,
  zip_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la recherche
CREATE INDEX idx_upsell_orders_user ON public.upsell_orders(user_id);
CREATE INDEX idx_upsell_orders_session ON public.upsell_orders(session_id);

-- Enable RLS
ALTER TABLE public.upsell_orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own upsell orders" ON upsell_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own upsell orders" ON upsell_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Table pour les assets générés par l'upsell
CREATE TABLE public.upsell_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upsell_order_id UUID REFERENCES upsell_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  brand_id UUID REFERENCES brands(id),
  structure TEXT NOT NULL,
  variation_index INTEGER NOT NULL,
  format TEXT NOT NULL DEFAULT '4:5',
  cloudinary_url TEXT,
  cloudinary_public_id TEXT,
  file_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la performance
CREATE INDEX idx_upsell_assets_order ON public.upsell_assets(upsell_order_id);
CREATE INDEX idx_upsell_assets_user ON public.upsell_assets(user_id);

-- Enable RLS
ALTER TABLE public.upsell_assets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own upsell assets" ON upsell_assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage upsell assets" ON upsell_assets
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.upsell_orders;