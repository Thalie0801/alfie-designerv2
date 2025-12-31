-- ============================================
-- Pro Video Pipeline - Database Schema
-- ============================================

-- Table: video_projects (projets vidéo avec mode lip-sync ou voiceover)
CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'voiceover' CHECK (mode IN ('lipsync', 'voiceover')),
  ratio TEXT NOT NULL DEFAULT '9:16',
  style_preset_id TEXT,
  anchor_face_image_url TEXT,
  anchor_set_image_url TEXT,
  anchor_style_text TEXT,
  music_volume INTEGER NOT NULL DEFAULT 15 CHECK (music_volume >= 0 AND music_volume <= 100),
  ducking_enabled BOOLEAN NOT NULL DEFAULT true,
  voice_lufs_target INTEGER NOT NULL DEFAULT -16,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: video_project_clips (clips individuels d'un projet)
CREATE TABLE IF NOT EXISTS public.video_project_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  clip_index INTEGER NOT NULL,
  veo_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'muting', 'completed', 'failed')),
  video_url_raw TEXT,
  video_url_muted TEXT,
  duration_sec INTEGER DEFAULT 8,
  prompt TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, clip_index)
);

-- Table: video_project_audio (assets audio d'un projet)
CREATE TABLE IF NOT EXISTS public.video_project_audio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('voice', 'music')),
  source TEXT NOT NULL DEFAULT 'elevenlabs' CHECK (source IN ('elevenlabs', 'upload', 'veo')),
  url TEXT NOT NULL,
  lufs_measured NUMERIC,
  volume_percent INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: video_project_renders (rendus finaux avec anti-doublon)
CREATE TABLE IF NOT EXISTS public.video_project_renders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  final_video_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mixing', 'completed', 'failed')),
  audio_mix_hash TEXT UNIQUE,
  audio_mixed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_project_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_project_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_project_renders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: video_projects
CREATE POLICY "Users can view their own video projects"
  ON public.video_projects FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own video projects"
  ON public.video_projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own video projects"
  ON public.video_projects FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own video projects"
  ON public.video_projects FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies: video_project_clips (via project ownership)
CREATE POLICY "Users can view clips of their projects"
  ON public.video_project_clips FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_clips.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create clips for their projects"
  ON public.video_project_clips FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_clips.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update clips of their projects"
  ON public.video_project_clips FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_clips.project_id AND user_id = auth.uid()
  ));

-- RLS Policies: video_project_audio (via project ownership)
CREATE POLICY "Users can view audio of their projects"
  ON public.video_project_audio FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_audio.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create audio for their projects"
  ON public.video_project_audio FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_audio.project_id AND user_id = auth.uid()
  ));

-- RLS Policies: video_project_renders (via project ownership)
CREATE POLICY "Users can view renders of their projects"
  ON public.video_project_renders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_renders.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create renders for their projects"
  ON public.video_project_renders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_renders.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update renders of their projects"
  ON public.video_project_renders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.video_projects 
    WHERE id = video_project_renders.project_id AND user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_projects_user_id ON public.video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_video_project_clips_project_id ON public.video_project_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_video_project_audio_project_id ON public.video_project_audio(project_id);
CREATE INDEX IF NOT EXISTS idx_video_project_renders_project_id ON public.video_project_renders(project_id);
CREATE INDEX IF NOT EXISTS idx_video_project_renders_audio_mix_hash ON public.video_project_renders(audio_mix_hash);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_video_projects_updated_at
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_video_project_clips_updated_at
  BEFORE UPDATE ON public.video_project_clips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_video_project_renders_updated_at
  BEFORE UPDATE ON public.video_project_renders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();