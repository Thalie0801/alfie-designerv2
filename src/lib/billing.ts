import { supabase } from '@/integrations/supabase/client';

const ACTIVE_PLANS = new Set(['starter', 'pro', 'studio', 'enterprise']);

interface ProfileRecord {
  id?: string;
  plan?: string | null;
  status?: string | null;
  granted_by_admin?: boolean | null;
}

interface SubscriptionRecord {
  status?: string | null;
  current_period_end?: string | null;
}

export async function hasActiveSubscriptionByEmail(
  email: string,
  options?: { userId?: string }
): Promise<boolean> {
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return false;

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

    if (userId || profile.id) {
      const targetId = userId ?? profile.id;
      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('status, current_period_end')
        .eq('user_id', targetId)
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRecord>();

      if (subscriptionError) {
        console.warn('[billing] Subscription lookup failed, falling back to profile status:', subscriptionError);
      } else if (subscription) {
        const subscriptionStatus = (subscription.status ?? '').toLowerCase();
        const isActive = ['active', 'trialing', 'trial'].includes(subscriptionStatus);
        if (isActive) {
          if (!subscription.current_period_end) {
            return true;
          }
          const end = new Date(subscription.current_period_end);
          if (!Number.isNaN(end.getTime()) && end > new Date()) {
            return true;
          }
        }
      }
    }
  } catch (error) {
    console.error('[billing] Unexpected error while checking subscription:', error);
  }

  return false;
}
