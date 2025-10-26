-- Activer RLS sur la table plans_config qui n'en avait pas
ALTER TABLE public.plans_config ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique pour plans_config (données de configuration)
CREATE POLICY "Plans configuration publicly readable"
ON public.plans_config FOR SELECT
USING (true);

-- Seuls les admins peuvent modifier
CREATE POLICY "Only admins can modify plans"
ON public.plans_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Ajouter des policies de stockage RLS pour chat-uploads
CREATE POLICY "Users can view own chat uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);