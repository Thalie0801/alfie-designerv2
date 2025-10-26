import type { User } from '@supabase/supabase-js';

type SubscriptionLike = {
  status?: string | null;
  current_period_end?: string | Date | null;
} | null | undefined;

type ProfileLike = {
  status?: string | null;
  plan?: string | null;
  granted_by_admin?: boolean | null;
} | null | undefined;

/**
 * Vérifie si un utilisateur est autorisé à accéder à la plateforme
 * 
 * HIÉRARCHIE D'AUTORISATION (ordre de priorité) :
 * 
 * 1. Kill switch désactivé (ENV: VITE_AUTH_ENFORCEMENT=off)
 *    → ✅ Accès total (dev mode uniquement)
 * 
 * 2. Admin (rôle 'admin' dans user_roles)
 *    → ✅ Accès total, toutes fonctionnalités
 * 
 * 3. Accès manuel (profile.granted_by_admin = true)
 *    → ✅ Accès selon le plan assigné
 *    → Utilisé pour : ambassadeurs avec accès spécial, testeurs, partenaires
 *    → Quotas définis manuellement dans le profil
 * 
 * 4. Plan payé actif (profile.plan + profile.stripe_subscription_id)
 *    → ✅ Accès selon le plan payé
 *    → Client classique OU ambassadeur payant
 *    → Quotas définis par le plan
 * 
 * 5. Statut "active" sans plan
 *    → ✅ Accès basique (fallback)
 * 
 * 6. Abonnement Stripe actif
 *    → ✅ Accès si subscription.status = 'active'|'trial'|'trialing'
 *    → ET current_period_end > now()
 * 
 * 7. Sinon → ❌ Redirection vers /onboarding/activate
 * 
 * SÉCURITÉ CRITIQUE :
 * - Les champs sensibles (plan, granted_by_admin, quotas) ne peuvent être modifiés que par :
 *   ✓ Les edge functions (service role)
 *   ✓ Les admins (policy RLS dédiée)
 * - Les utilisateurs NE PEUVENT PAS s'auto-attribuer des permissions
 * - Toute tentative de modification via client sera bloquée par RLS
 * 
 * AMBASSADEURS :
 * - Client qui s'inscrit via un lien d'affilié → devient automatiquement ambassadeur
 * - Badge ambassadeur visible dans le profil
 * - Système de gamification (créateur → mentor → leader)
 * - Commissions MLM sur 3 niveaux (15% / 5% / 2%)
 * 
 * @param user - Utilisateur Supabase (auth.users)
 * @param options.isAdmin - True si l'utilisateur a le rôle 'admin' dans user_roles
 * @param options.profile - Profil utilisateur (profiles table)
 * @param options.subscription - Abonnement Stripe éventuel
 * @param options.killSwitchDisabled - True si AUTH_ENFORCEMENT=off (dev only)
 * @returns boolean - True si l'utilisateur peut accéder à la plateforme
 */
export function isAuthorized(user: User | null, options?: {
  isAdmin?: boolean;
  profile?: ProfileLike;
  subscription?: SubscriptionLike;
  killSwitchDisabled?: boolean;
}): boolean {
  const { isAdmin = false, profile, subscription, killSwitchDisabled = false } = options ?? {};

  if (!user) return false;
  if (killSwitchDisabled) return true;
  if (isAdmin) return true;
  if (profile?.granted_by_admin) return true;

  const plan = profile?.plan?.toLowerCase();
  const hasPaidPlan = plan ? ['starter', 'pro', 'studio', 'enterprise'].includes(plan) : false;
  if (profile?.status === 'active' && hasPaidPlan) return true;

  if (profile?.status === 'active') return true;

  if (subscription) {
    const normalizedStatus = subscription.status?.toLowerCase();
    const isActive =
      normalizedStatus === 'active' ||
      normalizedStatus === 'trial' ||
      normalizedStatus === 'trialing';

    if (isActive) {
      if (!subscription.current_period_end) {
        return true;
      }

      const periodEnd =
        subscription.current_period_end instanceof Date
          ? subscription.current_period_end
          : new Date(subscription.current_period_end);

      if (!Number.isNaN(periodEnd.getTime()) && periodEnd > new Date()) {
        return true;
      }
    }
  }

  return false;
}
