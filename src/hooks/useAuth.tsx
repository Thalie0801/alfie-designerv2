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
      return false;
    }

    if (killSwitchDisabled) {
      return true;
    }

    // Vérifier d'abord si l'utilisateur est VIP ou Admin par email
    if (isVipOrAdmin(currentUser.email)) {
      return true;
    }

    // Vérifier également si l'utilisateur a un rôle admin en DB
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .eq('role', 'admin');

    if (adminRoles && adminRoles.length > 0) {
      return true;
    }

    const hasSubscription = await hasActiveSubscriptionByEmail(currentUser.email, {
      userId: currentUser.id,
    });

    if (!hasSubscription) {
      console.warn('[Auth] Access denied: subscription required for', currentUser.email);
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
      await supabase.auth.signOut();
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

    if (killSwitchDisabled || isVipOrAdmin(userFromAuth.email)) {
      return { error: null };
    }

    const hasSubscription = await hasActiveSubscriptionByEmail(userFromAuth.email, {
      userId: userFromAuth.id,
    });

    if (!hasSubscription) {
      await supabase.auth.signOut();
      return { error: new Error('NO_ACTIVE_SUBSCRIPTION') };
    }

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
  const computedIsAuthorized = computeIsAuthorized(user, {
    isAdmin: computedAdmin,
    profile,
    subscription,
    killSwitchDisabled,
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
