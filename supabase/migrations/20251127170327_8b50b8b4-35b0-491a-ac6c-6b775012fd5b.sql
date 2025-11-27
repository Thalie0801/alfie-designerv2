-- Migration du système Woofs unifié
-- Peupler plans_config avec les bons quotas Woofs

INSERT INTO plans_config (plan, woofs_per_month, visuals_per_month, storage_days, price_eur, durations)
VALUES 
  ('starter', 150, 150, 30, 39, '["8","15"]'),
  ('pro', 450, 450, 30, 99, '["8","15","30"]'),
  ('studio', 1000, 1000, 30, 199, '["8","15","30","60"]')
ON CONFLICT (plan) DO UPDATE SET 
  woofs_per_month = EXCLUDED.woofs_per_month,
  visuals_per_month = EXCLUDED.visuals_per_month,
  durations = EXCLUDED.durations;

-- Synchroniser brands.quota_woofs selon le plan
UPDATE brands b
SET quota_woofs = COALESCE(
  (SELECT woofs_per_month FROM plans_config WHERE plan = b.plan),
  150
)
WHERE quota_woofs = 0 OR quota_woofs IS NULL;

-- Réinitialiser les compteurs Woofs pour le nouveau système
UPDATE counters_monthly SET woofs_used = 0;