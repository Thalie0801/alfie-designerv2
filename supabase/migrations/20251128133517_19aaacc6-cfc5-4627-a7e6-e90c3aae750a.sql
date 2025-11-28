-- Créer le bucket chat-uploads pour les images de référence
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Politique : utilisateurs authentifiés peuvent uploader
CREATE POLICY "Authenticated users can upload to chat-uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-uploads');

-- Politique : accès public en lecture (pour afficher les images)
CREATE POLICY "Public can view chat-uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-uploads');

-- Politique : utilisateurs peuvent supprimer leurs propres fichiers
CREATE POLICY "Users can delete their own chat-uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);