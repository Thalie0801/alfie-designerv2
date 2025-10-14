-- Bucket for generated assets (images & videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload generated assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can manage their generated assets"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their generated assets"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public assets are viewable"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'assets');
