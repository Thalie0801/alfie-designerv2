import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
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

  const ensureStudioPlanForTestAccount = async (profileData: any) => {
    // Removed hardcoded test account logic for security
    return profileData;
  };

  const refreshProfile = async (sessionOverride?: Session | null) => {
    // Utiliser la session passée en paramètre OU le state (fix race condition)
    const targetSession = sessionOverride ?? session;
    if (!targetSession?.user) {
      console.debug('[Auth] refreshProfile: no session available');
      return;
    }

    const userId = targetSession.user.id;
    console.debug('[Auth] refreshProfile: starting for user', userId);

    // ============================================================================
    // ÉTAPE 1: Charger le profil d'abord (source de vérité DB) - NON BLOQUANT
    // ============================================================================
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('[Auth] refreshProfile: failed to load profile', profileError);
    }

    if (profileData) {
      const ensuredProfile = await ensureStudioPlanForTestAccount(profileData);
      setProfile(ensuredProfile);
      
      // Définir les cookies pour stabiliser les redirects
      const plan = ensuredProfile.plan ?? 'none';
      const grantedByAdmin = ensuredProfile.granted_by_admin ?? false;
      document.cookie = `plan=${plan}; Max-Age=${60*60*12}; Path=/; SameSite=Lax`;
      document.cookie = `granted_by_admin=${grantedByAdmin}; Max-Age=${60*60*12}; Path=/; SameSite=Lax`;
      console.debug('[Auth] refreshProfile: profile loaded', { 
        plan, 
        status: ensuredProfile.status,
        grantedByAdmin 
      });
    }

    // ============================================================================
    // ÉTAPE 2: Charger les rôles (en parallèle, non bloquant)
    // ============================================================================
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (rolesData) {
      setRoles(rolesData.map(r => r.role));
      console.debug('[Auth] refreshProfile: roles loaded', rolesData.map(r => r.role));
    }

    // ============================================================================
    // ÉTAPE 3: Vérifier subscription Stripe (complément, NON BLOQUANT)
    // ============================================================================
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (!error && data) {
        const isExpired = data.current_period_end ? new Date(data.current_period_end) < new Date() : false;
        setSubscription({
          status: isExpired ? 'expired' : (data.subscribed ? 'active' : 'none'),
          current_period_end: data.current_period_end ?? null,
        } as any);
      } else {
        // Ne PAS bloquer si check-subscription échoue - le profil DB suffit
        console.debug('[Auth] refreshProfile: check-subscription returned no data, using profile as fallback');
        setSubscription(null);
      }
    } catch (err) {
      // Ne PAS bloquer si check-subscription timeout - le profil DB suffit
      console.debug('[Auth] refreshProfile: check-subscription failed, using profile as fallback', err);
      setSubscription(null);
    }
  };

  useEffect(() => {
    // Safety timeout: force loading to false after 5 seconds (REDUCED from 10s)
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] Session verification timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        clearTimeout(safetyTimeout);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Defer profile fetch with setTimeout - PASSER currentSession directement
        if (currentSession?.user) {
          setTimeout(() => {
            refreshProfile(currentSession);
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
          setRoles([]);
        }
      }
    );

    // Then check for existing session with timeout
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        clearTimeout(safetyTimeout);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          setTimeout(() => {
            refreshProfile(currentSession).then(() => setLoading(false));
          }, 0);
        } else {
          setLoading(false);
          setSubscription(null);
        }
      })
      .catch((error) => {
        console.error('[Auth] Failed to get session:', error);
        clearTimeout(safetyTimeout);
        setLoading(false);
        setSession(null);
        setUser(null);
      });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
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
    const isVipOrAdmin = userRoles.includes('vip') || userRoles.includes('admin');

    if (isVipOrAdmin) {
      console.debug('[Auth] signIn: bypass subscription check (VIP/Admin)', { 
        email: userFromAuth.email, 
        roles: userRoles,
        isVipOrAdmin
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

    if (!error && data.user && data.session) {
      // Force profile refresh after signup - passer la session directement
      await refreshProfile(data.session);
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
  // Plans actifs valides
  const ACTIVE_PLANS = ['starter', 'pro', 'studio', 'enterprise', 'admin'];
  
  const hasActivePlan = Boolean(
    vipBypass ||
    computedAdmin ||
    profile?.granted_by_admin ||
    // Vérification directe du profil (fallback si roles/subscription pas encore chargés)
    (profile?.status === 'active' && profile?.plan && ACTIVE_PLANS.includes(profile.plan.toLowerCase())) ||
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
