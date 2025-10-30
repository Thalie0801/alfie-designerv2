import { supabase } from '@/integrations/supabase/client';
import { isVip } from '@/lib/access';

const ACTIVE_PLANS = new Set(['starter', 'pro', 'studio', 'enterprise']);

interface ProfileRecord {
  id?: string;
  plan?: string | null;
  status?: string | null;
  granted_by_admin?: boolean | null;
}

export async function hasActiveSubscriptionByEmail(
  email: string,
  options?: { userId?: string }
): Promise<boolean> {
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  // Si VIP par whitelist → accès garanti même sans profil
  if (isVip(normalizedEmail)) {
    console.debug('[billing] VIP email detected, granting access:', normalizedEmail);
    return true;
  }

  try {
    const { userId } = options ?? {};
    const column = userId ? 'id' : 'email';
    const value = userId ?? normalizedEmail;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, plan, status, granted_by_admin')
      .eq(column, value)
      .maybeSingle<ProfileRecord>();

    if (profileError) {
      console.error('[billing] Unable to fetch profile for access control:', profileError);
      return false;
    }

    if (!profile) {
      // Si VIP mais pas de profil, logger un warning
      if (isVip(normalizedEmail)) {
        console.warn('[billing] VIP user without profile detected:', normalizedEmail);
      }
      return false;
    }

    if (profile.granted_by_admin) {
      return true;
    }

    const plan = (profile.plan ?? '').toLowerCase();
    const status = (profile.status ?? '').toLowerCase();

    if (ACTIVE_PLANS.has(plan) && status === 'active') {
      return true;
    }

    // Check Stripe subscription via edge function for additional validation
    if (userId || profile.id) {
      try {
        const { data: subscriptionData } = await supabase.functions.invoke('check-subscription');
        if (subscriptionData?.subscribed) {
          return true;
        }
      } catch (err) {
        console.warn('[billing] Unable to check subscription via edge function:', err);
      }
    }
  } catch (error) {
    console.error('[billing] Unexpected error while checking subscription:', error);
  }

  return false;
}
