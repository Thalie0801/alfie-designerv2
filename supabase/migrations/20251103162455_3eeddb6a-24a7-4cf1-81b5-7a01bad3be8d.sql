-- Tables pour le système de workflow conversationnel Alfie

-- Table des commandes (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'brief_collection', 'text_generation', 'visual_generation', 'completed', 'failed')),
  brief_json JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des items de commande (images ou carrousels)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'carousel')),
  sequence_number INTEGER NOT NULL,
  brief_json JSONB NOT NULL DEFAULT '{}',
  text_json JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'text_generated', 'visual_generating', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des assets générés (amélioration de media_generations)
CREATE TABLE IF NOT EXISTS public.library_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'carousel_slide')),
  campaign TEXT,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  text_json JSONB DEFAULT '{}',
  format TEXT,
  tags TEXT[] DEFAULT '{}',
  slide_index INTEGER,
  carousel_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des sessions de conversation Alfie
CREATE TABLE IF NOT EXISTS public.alfie_conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  conversation_state TEXT NOT NULL DEFAULT 'initial' CHECK (conversation_state IN ('initial', 'collecting_image_brief', 'collecting_carousel_brief', 'confirming', 'generating', 'completed')),
  context_json JSONB NOT NULL DEFAULT '{}',
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand_id ON public.orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);
CREATE INDEX IF NOT EXISTS idx_library_assets_user_id ON public.library_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_library_assets_brand_id ON public.library_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_library_assets_order_id ON public.library_assets(order_id);
CREATE INDEX IF NOT EXISTS idx_library_assets_campaign ON public.library_assets(campaign);
CREATE INDEX IF NOT EXISTS idx_library_assets_tags ON public.library_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_alfie_sessions_user_id ON public.alfie_conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_alfie_sessions_order_id ON public.alfie_conversation_sessions(order_id);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_assets_updated_at BEFORE UPDATE ON public.library_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alfie_sessions_updated_at BEFORE UPDATE ON public.alfie_conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alfie_conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Order items policies
CREATE POLICY "Users can view their order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

CREATE POLICY "Users can create order items" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

CREATE POLICY "Users can update their order items" ON public.order_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

-- Library assets policies
CREATE POLICY "Users can view their library assets" ON public.library_assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create library assets" ON public.library_assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their library assets" ON public.library_assets
  FOR UPDATE USING (auth.uid() = user_id);

-- Alfie conversation sessions policies
CREATE POLICY "Users can view their conversation sessions" ON public.alfie_conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their conversation sessions" ON public.alfie_conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their conversation sessions" ON public.alfie_conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);