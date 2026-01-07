-- Améliorer la politique d'upload pour vérifier l'authentification
DROP POLICY IF EXISTS "Authenticated users can upload to chat-uploads" ON storage.objects;

CREATE POLICY "Authenticated users can upload to chat-uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-uploads' AND auth.uid() IS NOT NULL);