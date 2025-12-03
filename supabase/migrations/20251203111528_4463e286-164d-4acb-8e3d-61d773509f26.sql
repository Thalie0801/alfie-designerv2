-- Brand Kit V2 - Enriched brand profile for better AI generation

-- Bloc 1 - Identité enrichie
ALTER TABLE brands ADD COLUMN IF NOT EXISTS pitch TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS adjectives TEXT[] DEFAULT '{}';

-- Bloc 2 - Voix & Ton structuré  
ALTER TABLE brands ADD COLUMN IF NOT EXISTS tone_sliders JSONB DEFAULT '{"fun": 5, "accessible": 5, "energetic": 5, "direct": 5}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS person TEXT DEFAULT 'tu';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS language_level TEXT DEFAULT 'courant';

-- Bloc 3 - Style visuel
ALTER TABLE brands ADD COLUMN IF NOT EXISTS visual_types TEXT[] DEFAULT '{}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS visual_mood TEXT[] DEFAULT '{}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS avoid_in_visuals TEXT;

-- Bonus
ALTER TABLE brands ADD COLUMN IF NOT EXISTS tagline TEXT;