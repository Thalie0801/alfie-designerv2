import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAuthorized as computeIsAuthorized } from '@/utils/authz-helpers';
import { hasRole, getUserRoles } from '@/lib/access';
import { hasActiveSubscriptionByEmail } from '@/lib/billing';
import { withRetry } from '@/lib/supabaseRetry';
import { saveAuthToCache, loadAuthFromCache } from '@/lib/authCache';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  subscription: any | null;
  roles: string[];
  isAdmin: boolean;
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

  const ensureActiveSubscription = async (currentUser: User | null, cachedRoles?: string[]) => {
    if (!currentUser?.email) {
      console.debug('[Auth] ensureActiveSubscription: no user email');
      return false;
    }

    // Utiliser les rôles passés en paramètre ou le cache getUserRoles
    const userRoles = cachedRoles ?? await getUserRoles(currentUser.id);
    const isVipOrAdmin = userRoles.includes('vip') || userRoles.includes('admin');

    if (isVipOrAdmin) {
      console.debug('[Auth] ensureActiveSubscription: user has VIP/Admin role', { roles: userRoles });
      return true;
    }

    const hasSubscription = await hasActiveSubscriptionByEmail(currentUser.email, {
      userId: currentUser.id,
    });

    console.debug('[Auth] ensureActiveSubscription:', { 
      email: currentUser.email, 
      hasSubscription 
    });

    return hasSubscription;
  };

  const ensureStudioPlanForTestAccount = async (profileData: any) => {
    // Removed hardcoded test account logic for security
    return profileData;
  };

  const refreshProfile = async () => {
    if (!session?.user) return;

    try {
      // 1. Récupérer les rôles UNE SEULE FOIS via cache
      const userRoles = await withRetry(
        () => getUserRoles(session.user.id),
        { maxRetries: 3, timeoutMs: 5000 }
      );
      setRoles(userRoles);

      // 2. Vérifier l'accès en passant les rôles
      const allowed = await ensureActiveSubscription(session.user, userRoles);
      if (!allowed) {
        console.debug('[Auth] refreshProfile: access not allowed, clearing profile');
        setProfile(null);
        setSubscription(null);
        return;
      }

      // 3. Récupérer le profil avec retry
      const profileResponse = await withRetry(
        async () => await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single(),
        { maxRetries: 3, timeoutMs: 5000 }
      );
      const profileData = profileResponse.data;

      if (profileData) {
        const ensuredProfile = await ensureStudioPlanForTestAccount(profileData);
        setProfile(ensuredProfile);
        
        const plan = ensuredProfile.plan ?? 'none';
        const grantedByAdmin = ensuredProfile.granted_by_admin ?? false;
        document.cookie = `plan=${plan}; Max-Age=${60*60*12}; Path=/; SameSite=Lax`;
        document.cookie = `granted_by_admin=${grantedByAdmin}; Max-Age=${60*60*12}; Path=/; SameSite=Lax`;
        
        // Sauvegarder dans le cache local pour mode dégradé
        saveAuthToCache({
          userId: session.user.id,
          email: session.user.email ?? '',
          roles: userRoles,
          plan,
          hasActivePlan: true,
        });
      }

      // 4. Déterminer l'état de souscription depuis le profil (pas d'Edge Function)
      const isExpired = profileData?.status === 'expired';
      setSubscription({
        status: isExpired ? 'expired' : (profileData?.plan ? 'active' : 'none'),
        current_period_end: null,
      } as any);

    } catch (error) {
      console.error('[Auth] refreshProfile failed:', error);
      
      // Mode dégradé : charger depuis le cache
      const cached = loadAuthFromCache(session.user.id);
      if (cached) {
        console.warn('[Auth] Using cached auth data (degraded mode)');
        setRoles(cached.roles);
        setProfile({ plan: cached.plan });
      }
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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await withRetry(
        () => supabase.auth.signInWithPassword({ email, password }),
        { maxRetries: 3, timeoutMs: 5000 }
      );
      
      if (error) return { error };

      const userFromAuth = data.user ?? null;
      if (!userFromAuth?.email) {
        await supabase.auth.signOut();
        return { error: new Error('NO_ACTIVE_SUBSCRIPTION') };
      }

      // Récupérer les rôles UNE SEULE FOIS via cache
      const userRoles = await getUserRoles(userFromAuth.id);
      const isVipOrAdmin = userRoles.includes('vip') || userRoles.includes('admin');

      if (isVipOrAdmin) {
        console.debug('[Auth] signIn: VIP/Admin access', { roles: userRoles });
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

      console.debug('[Auth] signIn: success');
      return { error: null };
    } catch (error) {
      console.error('[Auth] signIn failed:', error);
      return { error: error as Error };
    }
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
  
  // 1. Calculer vipBypass en premier (VIP ou Admin)
  const vipBypass = roleVip || roleAdmin;
  
  // 2. Calculer computedIsAuthorized avec vipBypass
  const computedIsAuthorized = vipBypass || computeIsAuthorized(user, {
    isAdmin: computedAdmin,
    roles,
    profile,
    subscription,
  });

  // 3. Log complet avec toutes les infos
  console.debug('[Auth] Authorization computed:', {
    email: user?.email,
    vipBypass,
    roleAdmin,
    computedAdmin,
    computedIsAuthorized,
    hasActivePlan: Boolean(
      vipBypass ||
      computedAdmin ||
      profile?.granted_by_admin ||
      (subscription?.status ? ['active', 'trial', 'trialing'].includes(String(subscription.status).toLowerCase()) : false)
    )
  });
  const hasActivePlan = Boolean(
    vipBypass ||
    computedAdmin ||
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
    isAdmin: computedAdmin,
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
