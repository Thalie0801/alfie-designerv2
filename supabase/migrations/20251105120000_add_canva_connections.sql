-- Create table to store OAuth tokens for Canva Connect
CREATE TABLE IF NOT EXISTS public.canva_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canva_user_id text,
  access_token text NOT NULL,
  refresh_token text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canva_connections_user_unique UNIQUE (user_id)
);

-- Store ephemeral OAuth state to user mappings
CREATE TABLE IF NOT EXISTS public.canva_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canva_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS canva_connections_user_id_idx
  ON public.canva_connections (user_id);

ALTER TABLE public.canva_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their Canva connection"
  ON public.canva_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their Canva connection"
  ON public.canva_connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their Canva connection"
  ON public.canva_connections
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_canva_connections_updated_at
  BEFORE UPDATE ON public.canva_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
