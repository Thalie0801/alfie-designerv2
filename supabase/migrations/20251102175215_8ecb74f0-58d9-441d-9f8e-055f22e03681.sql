-- Supprimer les anciennes politiques restrictives pour media_generations
DROP POLICY IF EXISTS "Users can view own brand media" ON media_generations;
DROP POLICY IF EXISTS "Users can create own brand media" ON media_generations;
DROP POLICY IF EXISTS "Users can update own brand media" ON media_generations;
DROP POLICY IF EXISTS "Users can delete own brand media" ON media_generations;

-- Créer de nouvelles politiques plus permissives (afficher tous les assets de l'utilisateur)
CREATE POLICY "Users can view all their media"
  ON media_generations
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own media"
  ON media_generations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own media"
  ON media_generations
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own media"
  ON media_generations
  FOR DELETE
  USING (user_id = auth.uid());