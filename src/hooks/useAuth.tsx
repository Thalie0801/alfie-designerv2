import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAuthorized as computeIsAuthorized } from '@/utils/authz-helpers';
import { hasRole } from '@/lib/access';
import { hasActiveSubscriptionByEmail } from '@/lib/billing';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  subscription: any | null;
  roles: string[];
  isAdmin: boolean;
  hasAdminOverride: boolean;
  isAuthorized: boolean;
  hasActivePlan: boolean;
  subscriptionExpired: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminOverride, setHasAdminOverride] = useState(false);

  const fetchAdminOverride = async (email: string | null | undefined) => {
    const normalizedEmail = (email ?? '').trim().toLowerCase();

    if (!normalizedEmail) {
      setHasAdminOverride(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', normalizedEmail)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] fetchAdminOverride failed:', error);
        setHasAdminOverride(false);
        return false;
      }

      const overrideActive = Boolean(data);
      setHasAdminOverride(overrideActive);
      return overrideActive;
    } catch (overrideError) {
      console.error('[Auth] Unexpected error while checking admin override:', overrideError);
      setHasAdminOverride(false);
      return false;
    }
  };

  const ensureActiveSubscription = async (currentUser: User | null) => {
    if (!currentUser?.email) {
      console.debug('[Auth] ensureActiveSubscription: no user email');
      return false;
    }

    const overrideActive = await fetchAdminOverride(currentUser.email);

    if (overrideActive) {
      console.debug('[Auth] ensureActiveSubscription: admin override grants access');
      return true;
    }

    // Vérifier si l'utilisateur a un rôle VIP ou Admin via la DB
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id);
    
    const userRoles = (rolesData || []).map(r => r.role);
    const isVipOrAdmin = userRoles.includes('vip') || userRoles.includes('admin');

    if (isVipOrAdmin) {
      console.debug('[Auth] ensureActiveSubscription: user has VIP/Admin role from database', { roles: userRoles });
      return true;
    }

    const hasSubscription = await hasActiveSubscriptionByEmail(currentUser.email, {
      userId: currentUser.id,
    });

    if (!hasSubscription) {
      console.debug('[Auth] ensureActiveSubscription: no active subscription for', currentUser.email);
    } else {
      console.debug('[Auth] ensureActiveSubscription: user has active subscription');
    }

    return hasSubscription;
  };

  const ensureStudioPlanForTestAccount = async (profileData: any) => {
    // Removed hardcoded test account logic for security
    return profileData;
  };

  const refreshProfile = async () => {
    if (!session?.user) return;

    const allowed = await ensureActiveSubscription(session.user);
    if (!allowed) {
      console.debug('[Auth] refreshProfile: access not allowed, clearing profile');
      // NE PAS déconnecter - laisser l'app gérer l'accès
      setProfile(null);
      setSubscription(null);
      setRoles([]);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileData) {
      const ensuredProfile = await ensureStudioPlanForTestAccount(profileData);
      setProfile(ensuredProfile);
      
      // Définir les cookies pour stabiliser les redirects
      const plan = ensuredProfile.plan ?? 'none';
      const grantedByAdmin = ensuredProfile.granted_by_admin ?? false;
      document.cookie = `plan=${plan}; Max-Age=${60*60*12}; Path=/; SameSite=Lax`;
      document.cookie = `granted_by_admin=${grantedByAdmin}; Max-Age=${60*60*12}; Path=/; SameSite=Lax`;
      console.debug('[Auth] refreshProfile: cookies set', { plan, grantedByAdmin });
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    if (rolesData) setRoles(rolesData.map(r => r.role));

    // Récupérer l'état d'abonnement via la fonction edge
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (!error && data) {
        const isExpired = data.current_period_end ? new Date(data.current_period_end) < new Date() : false;
        setSubscription({
          status: isExpired ? 'expired' : (data.subscribed ? 'active' : 'none'),
          current_period_end: data.current_period_end ?? null,
        } as any);
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Defer profile fetch with setTimeout
        if (currentSession?.user) {
          setTimeout(() => {
            refreshProfile();
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
          setRoles([]);
          setHasAdminOverride(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        setTimeout(() => {
          refreshProfile().then(() => setLoading(false));
        }, 0);
      } else {
        setLoading(false);
        setSubscription(null);
        setHasAdminOverride(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { error };
    }

    const userFromAuth = data.user ?? null;

    if (!userFromAuth?.email) {
      await supabase.auth.signOut();
      return { error: new Error('NO_ACTIVE_SUBSCRIPTION') };
    }

    // Vérifier si l'utilisateur a un rôle VIP ou Admin via la DB
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userFromAuth.id);
    
    const userRoles = (rolesData || []).map(r => r.role);
    const overrideActive = await fetchAdminOverride(userFromAuth.email);
    const isVipOrAdmin =
      userRoles.includes('vip') ||
      userRoles.includes('admin') ||
      overrideActive;

    if (isVipOrAdmin) {
      console.debug('[Auth] signIn: bypass subscription check (VIP/Admin)', {
        email: userFromAuth.email,
        roles: userRoles,
        isVipOrAdmin,
        overrideActive
      });
      return { error: null };
    }

    const hasSubscription = await hasActiveSubscriptionByEmail(userFromAuth.email, {
      userId: userFromAuth.id,
    });

    if (!hasSubscription) {
      console.debug('[Auth] signIn: no active subscription, signing out');
      await supabase.auth.signOut();
      return { error: new Error('NO_ACTIVE_SUBSCRIPTION') };
    }

    console.debug('[Auth] signIn: user has active subscription');
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    // Vérifier qu'une session de paiement validée existe pour cet email
    const {
      data: paymentSession,
      error: paymentError,
    } = await supabase
      .from('payment_sessions')
      .select('*')
      .eq('email', email)
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError || !paymentSession) {
      return {
        error:
          paymentError ??
          new Error('Aucun paiement validé trouvé. Veuillez choisir un plan.'),
      };
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          plan: paymentSession.plan,
          payment_session_id: paymentSession.id,
        },
      },
    });

    if (!error && data.user) {
      // Force profile refresh after signup
      await refreshProfile();
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Calculer les statuts VIP et Admin depuis les rôles de la DB
  const roleAdmin = hasRole(roles, 'admin');
  const roleVip = hasRole(roles, 'vip');
  const computedAdmin = roleAdmin;
  const adminAccess = computedAdmin || hasAdminOverride;

  // 1. Calculer vipBypass en premier (VIP ou Admin)
  const vipBypass = roleVip || adminAccess;

  // 2. Calculer computedIsAuthorized avec vipBypass
  const computedIsAuthorized = vipBypass || computeIsAuthorized(user, {
    isAdmin: adminAccess,
    roles,
    profile,
    subscription,
  });

  // 3. Log complet avec toutes les infos
  console.debug('[Auth] Authorization computed:', {
    email: user?.email,
    vipBypass,
    roleAdmin,
    computedAdmin: adminAccess,
    hasAdminOverride,
    computedIsAuthorized,
    hasActivePlan: Boolean(
      vipBypass ||
      adminAccess ||
      profile?.granted_by_admin ||
      (subscription?.status ? ['active', 'trial', 'trialing'].includes(String(subscription.status).toLowerCase()) : false)
    )
  });
  const hasActivePlan = Boolean(
    vipBypass ||
    adminAccess ||
    profile?.granted_by_admin ||
    (subscription?.status ? ['active', 'trial', 'trialing'].includes(String(subscription.status).toLowerCase()) : false)
  );

  const subscriptionExpired = subscription?.status === 'expired';

  const value = {
    user,
    session,
    profile,
    subscription,
    roles,
    isAdmin: adminAccess,
    hasAdminOverride,
    isAuthorized: computedIsAuthorized,
    hasActivePlan,
    subscriptionExpired,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
