-- Create media-generations storage bucket for ZIP downloads
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-generations', 'media-generations', false)
ON CONFLICT (id) DO NOTHING;

-- Service role can manage all files in media-generations
CREATE POLICY "Service role can manage media-generations"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'media-generations');

-- Authenticated users can read their own ZIPs
CREATE POLICY "Authenticated users can read media-generations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'media-generations');