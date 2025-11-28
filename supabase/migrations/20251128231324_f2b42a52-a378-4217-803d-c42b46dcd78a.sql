-- Ajouter un champ slug personnalisé pour les liens d'affiliation
ALTER TABLE public.affiliates
ADD COLUMN slug text UNIQUE;

-- Créer un index pour optimiser les recherches par slug
CREATE INDEX idx_affiliates_slug ON public.affiliates(slug);

-- Fonction pour générer un slug par défaut basé sur le nom
CREATE OR REPLACE FUNCTION generate_affiliate_slug(affiliate_name text, affiliate_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Nettoyer le nom pour créer un slug
  base_slug := lower(regexp_replace(affiliate_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Si le slug est vide, utiliser une partie de l'ID
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'affilie-' || substring(affiliate_id::text, 1, 8);
  END IF;
  
  -- S'assurer que le slug est unique
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM affiliates WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Policy pour permettre aux affiliés de mettre à jour leur propre slug
CREATE POLICY "Affiliates can update their own slug"
ON public.affiliates
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());