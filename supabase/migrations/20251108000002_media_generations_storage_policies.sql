-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read files from 'media-generations'
DROP POLICY IF EXISTS "media generations read" ON storage.objects;
CREATE POLICY "media generations read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'media-generations');

-- Allow authenticated users to insert their files into 'media-generations'
DROP POLICY IF EXISTS "media generations insert" ON storage.objects;
CREATE POLICY "media generations insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media-generations' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own files
DROP POLICY IF EXISTS "media generations update" ON storage.objects;
CREATE POLICY "media generations update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media-generations' AND (storage.foldername(name))[1] = auth.uid()::text);
