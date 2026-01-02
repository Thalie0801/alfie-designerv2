-- Table pour tracker l'usage quotidien des outils IA (rate limit gratuit)
CREATE TABLE IF NOT EXISTS public.ai_tools_daily_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_ai_tools_daily_usage_user_date ON public.ai_tools_daily_usage(user_id, date);

-- Activer RLS
ALTER TABLE public.ai_tools_daily_usage ENABLE ROW LEVEL SECURITY;

-- Policy: les users peuvent voir leur propre usage
CREATE POLICY "Users can view their own usage"
ON public.ai_tools_daily_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: insert/update via service role uniquement (edge function)
CREATE POLICY "Service role can manage usage"
ON public.ai_tools_daily_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger pour updated_at
CREATE TRIGGER update_ai_tools_daily_usage_updated_at
BEFORE UPDATE ON public.ai_tools_daily_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();