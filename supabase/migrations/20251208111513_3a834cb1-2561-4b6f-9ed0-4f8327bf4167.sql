-- Add text_color column to brands table for Brand Kit text customization
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#ffffff';

-- Add comment
COMMENT ON COLUMN public.brands.text_color IS 'Couleur de texte principale pour les overlays carrousels (format hex #RRGGBB)';