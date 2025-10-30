import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isAuthorized as computeIsAuthorized } from '@/utils/authz-helpers';
import { isVipOrAdmin, isAdmin as isAdminEmail } from '@/lib/access';
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

  const authEnforcement = import.meta.env.VITE_AUTH_ENFORCEMENT;
  const killSwitchDisabled =
    typeof authEnforcement === 'string' && authEnforcement.toLowerCase() === 'off';

  const ensureActiveSubscription = async (currentUser: User | null) => {
    if (!currentUser?.email) {
      console.debug('[Auth] ensureActiveSubscription: no user email');
      return false;
    }

    if (killSwitchDisabled) {
      console.debug('[Auth] ensureActiveSubscription: kill switch disabled, allowing access');
      return true;
    }

    // Vérifier d'abord si l'utilisateur est VIP ou Admin par email
    if (isVipOrAdmin(currentUser.email)) {
      console.debug('[Auth] ensureActiveSubscription: user is VIP/Admin by email');
      return true;
    }

    // Vérifier également si l'utilisateur a un rôle admin via RPC (bypass RLS)
    const { data: isAdminRpc, error: rpcError } = await supabase
      .rpc('has_role', { _user_id: currentUser.id, _role: 'admin' });

    if (!rpcError && isAdminRpc === true) {
      console.debug('[Auth] ensureActiveSubscription: user is admin via RPC');
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
        setSubscription({
          status: data.subscribed ? 'active' : 'none',
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

    const isWhitelisted = isVipOrAdmin(userFromAuth.email);
    if (killSwitchDisabled || isWhitelisted) {
      console.debug('[Auth] signIn: bypass subscription check', { 
        email: userFromAuth.email, 
        killSwitch: killSwitchDisabled, 
        isWhitelisted 
      });
      return { error: null };
    }

    // Vérifier si admin via RPC avant de check l'abonnement
    const { data: isAdminRpc, error: rpcError } = await supabase
      .rpc('has_role', { _user_id: userFromAuth.id, _role: 'admin' });
    
    if (!rpcError && isAdminRpc === true) {
      console.debug('[Auth] signIn: user is admin via RPC, bypassing subscription check');
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

  const roleAdmin = roles.includes('admin');
  const envAdmin = isAdminEmail(user?.email);
  const computedAdmin = roleAdmin || envAdmin;
  
  // 1. Calculer vipBypass en premier
  const vipBypass = isVipOrAdmin(user?.email);
  
  // 2. Calculer computedIsAuthorized avec vipBypass
  const computedIsAuthorized = vipBypass || computeIsAuthorized(user, {
    isAdmin: computedAdmin,
    profile,
    subscription,
    killSwitchDisabled,
  });

  // 3. Log complet avec toutes les infos
  console.debug('[Auth] Authorization computed:', {
    email: user?.email,
    vipBypass,
    roleAdmin,
    envAdmin,
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
    computedAdmin ||
    profile?.granted_by_admin ||
    (subscription?.status ? ['active', 'trial', 'trialing'].includes(String(subscription.status).toLowerCase()) : false)
  );

  const value = {
    user,
    session,
    profile,
    subscription,
    roles,
    isAdmin: computedAdmin,
    isAuthorized: computedIsAuthorized,
    hasActivePlan,
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
