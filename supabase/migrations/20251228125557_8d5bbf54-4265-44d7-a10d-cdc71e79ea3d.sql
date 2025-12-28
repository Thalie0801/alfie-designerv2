-- Table video_renders pour pipeline "Image First → Video → Post-prod"
CREATE TABLE public.video_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  order_id UUID,
  
  -- Status tracking du pipeline
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'image_generating', 'image_done', 'veo_running', 'veo_done', 'tts_done', 'rendering', 'done', 'failed')),
  
  -- Prompts
  visual_prompt TEXT NOT NULL,
  visual_prompt_en TEXT,
  
  -- Image de référence (Étape 1)
  reference_image_url TEXT,
  reference_cloudinary_id TEXT,
  
  -- Veo 3.1 (Étape 2)
  veo_operation TEXT,
  veo_base_url TEXT,
  cloudinary_base_id TEXT,
  
  -- Post-prod (Étape 3)
  voiceover_text TEXT,
  overlay_spec JSONB DEFAULT '{"lines": [], "style": {"font": "Montserrat", "size": 72, "color": "white", "stroke": "black"}, "timings": [0, 2, 4, 6, 8]}'::jsonb,
  cloudinary_audio_id TEXT,
  cloudinary_final_id TEXT,
  cloudinary_final_url TEXT,
  srt TEXT,
  
  -- Config
  aspect_ratio TEXT DEFAULT '9:16',
  duration_seconds INTEGER DEFAULT 8,
  with_audio BOOLEAN DEFAULT true,
  
  -- Errors
  error TEXT,
  error_step TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_video_renders_user ON public.video_renders(user_id);
CREATE INDEX idx_video_renders_order ON public.video_renders(order_id);
CREATE INDEX idx_video_renders_status ON public.video_renders(status);

-- RLS
ALTER TABLE public.video_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video renders" ON public.video_renders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video renders" ON public.video_renders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video renders" ON public.video_renders
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access video_renders" ON public.video_renders
  FOR ALL USING (true) WITH CHECK (true);

-- Realtime pour Job Console
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_renders;

-- Trigger updated_at
CREATE TRIGGER update_video_renders_updated_at
  BEFORE UPDATE ON public.video_renders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();