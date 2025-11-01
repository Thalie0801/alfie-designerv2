-- Add asset metadata columns to alfie_messages table
ALTER TABLE public.alfie_messages 
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.media_generations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_type text CHECK (asset_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS output_url text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS engine text,
  ADD COLUMN IF NOT EXISTS woofs_consumed integer;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_alfie_messages_asset_id ON public.alfie_messages(asset_id);

-- Add comments for documentation
COMMENT ON COLUMN public.alfie_messages.asset_id IS 'Reference to the generated media asset';
COMMENT ON COLUMN public.alfie_messages.asset_type IS 'Type of asset: image or video';
COMMENT ON COLUMN public.alfie_messages.output_url IS 'Direct URL to the generated asset';
COMMENT ON COLUMN public.alfie_messages.expires_at IS 'Expiration date of the asset';
COMMENT ON COLUMN public.alfie_messages.engine IS 'AI engine used for generation';
COMMENT ON COLUMN public.alfie_messages.woofs_consumed IS 'Cost in woofs for this generation';