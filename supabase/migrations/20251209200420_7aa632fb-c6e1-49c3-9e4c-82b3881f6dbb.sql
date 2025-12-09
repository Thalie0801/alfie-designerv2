-- Ajouter le champ avatar_url distinct du logo
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.brands.avatar_url IS 'Avatar/mascotte distinct du logo de marque - utilisé pour générations de personnages';
COMMENT ON COLUMN public.brands.logo_url IS 'Logo commercial de la marque - affiché sur les visuels si activé';