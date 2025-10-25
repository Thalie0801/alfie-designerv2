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

  if (subscription) {
    const normalizedStatus = subscription.status?.toLowerCase();
    const isActive = normalizedStatus === 'active' || normalizedStatus === 'trial' || normalizedStatus === 'trialing';
  if (profile?.status === 'active') return true;

  if (subscription) {
    const isActive = (subscription.status === 'active' || subscription.status === 'trial');
    if (isActive) {
      if (!subscription.current_period_end) {
        return true;
      }
      const periodEnd = subscription.current_period_end instanceof Date
        ? subscription.current_period_end
        : new Date(subscription.current_period_end);
      if (!Number.isNaN(periodEnd.getTime()) && periodEnd > new Date()) {
        return true;
      }
    }
  }

  return false;
}
