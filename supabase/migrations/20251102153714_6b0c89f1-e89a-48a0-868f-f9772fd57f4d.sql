-- Fixer les quotas pour tous les utilisateurs : 1 brand gratuit
UPDATE profiles
SET quota_brands = 1
WHERE quota_brands = 0 OR quota_brands IS NULL;

-- Audit des brands existantes (pour les logs)
COMMENT ON COLUMN brands.stripe_subscription_id IS 'ID de l''abonnement Stripe pour les brands payantes';