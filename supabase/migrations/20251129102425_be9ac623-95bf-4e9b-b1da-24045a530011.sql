-- Phase 5: Create alfie_memory table for user preferences
CREATE TABLE IF NOT EXISTS public.alfie_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  
  -- Préférences de génération
  default_ratio TEXT DEFAULT '4:5',
  default_platform TEXT DEFAULT 'instagram',
  default_tone TEXT,
  default_cta TEXT,
  default_slides INTEGER DEFAULT 5,
  default_language TEXT DEFAULT 'fr',
  
  -- Historique d'usage
  last_format TEXT,
  last_topic TEXT,
  preferred_goals TEXT[] DEFAULT ARRAY['engagement'],
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, brand_id)
);

-- RLS
ALTER TABLE public.alfie_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memory"
  ON public.alfie_memory
  FOR ALL
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alfie_memory_updated_at
  BEFORE UPDATE ON public.alfie_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();