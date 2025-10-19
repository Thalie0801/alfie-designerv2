import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  roles: string[];
  isAdmin: boolean;
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
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const ensureStudioPlanForTestAccount = async (profileData: any) => {
    if (!session?.user?.email || session.user.email !== 'nathaliestaelens@gmail.com') {
      return profileData;
    }

    if (profileData?.plan === 'studio') {
      return profileData;
    }

    const quotaBrands = profileData?.quota_brands && profileData.quota_brands > 0 ? profileData.quota_brands : 1;
    const updates = {
      plan: 'studio',
      quota_brands: quotaBrands,
      quota_visuals_per_month: Math.max(profileData?.quota_visuals_per_month ?? 0, 1000),
      quota_videos: Math.max(profileData?.quota_videos ?? 0, 100)
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to activate Studio plan for test account', error);
      return profileData;
    }

    return data ?? { ...profileData, ...updates };
  };

  const refreshProfile = async () => {
    if (!session?.user) return;

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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
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

  const value = {
    user,
    session,
    profile,
    roles,
    isAdmin: roles.includes('admin'),
    hasActivePlan: profile?.plan && profile?.plan !== 'none',
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
