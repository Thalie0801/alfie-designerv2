-- Migration: Create campaigns and assets tables for campaign factory
-- Date: 2025-11-20
-- Description: Tables pour l'usine à campagnes (images + carrousels)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: campaigns
-- Stores campaign metadata and status
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('draft', 'running', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: assets
-- Stores individual assets (images, carousels, videos) within campaigns
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'carousel', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  config JSONB NOT NULL DEFAULT '{}',
  file_urls JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assets_campaign_id ON public.assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns table
-- Users can only see their own campaigns
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own campaigns
CREATE POLICY "Users can insert their own campaigns"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own campaigns
CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own campaigns
CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for assets table
-- Users can only see assets from their own campaigns
CREATE POLICY "Users can view assets from their own campaigns"
  ON public.assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = assets.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can insert assets into their own campaigns
CREATE POLICY "Users can insert assets into their own campaigns"
  ON public.assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = assets.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can update assets from their own campaigns
CREATE POLICY "Users can update assets from their own campaigns"
  ON public.assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = assets.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = assets.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can delete assets from their own campaigns
CREATE POLICY "Users can delete assets from their own campaigns"
  ON public.assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = assets.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at automatically
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.campaigns IS 'Campaigns created by users for organizing marketing assets';
COMMENT ON TABLE public.assets IS 'Individual assets (images, carousels, videos) within campaigns';
COMMENT ON COLUMN public.campaigns.status IS 'Campaign status: draft, running, or done';
COMMENT ON COLUMN public.assets.status IS 'Asset generation status: pending, generating, ready, or failed';
COMMENT ON COLUMN public.assets.config IS 'JSON configuration including prompt, slides, options, etc.';
COMMENT ON COLUMN public.assets.file_urls IS 'JSON array of Supabase Storage URLs for generated files';
