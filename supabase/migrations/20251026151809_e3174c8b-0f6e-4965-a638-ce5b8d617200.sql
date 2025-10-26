-- Ajouter les colonnes manquantes à payment_sessions
ALTER TABLE payment_sessions 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_payment_sessions_email_verified 
  ON payment_sessions(email, verified);

-- Mettre à jour les anciennes lignes si elles existent
UPDATE payment_sessions 
SET created_at = processed_at 
WHERE created_at IS NULL;