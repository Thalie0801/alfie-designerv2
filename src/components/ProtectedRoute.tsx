import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { hasRole } from '@/lib/access';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowPending?: boolean;
  requireActivePlan?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  allowPending = false,
  requireActivePlan = true,
}: ProtectedRouteProps) {
  const { user, isAdmin, isAuthorized, hasActivePlan, roles, profile, loading, refreshProfile } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // ============================================================================
  // LOGIQUE WHITELIST: Accès dashboard forcé pour comptes exceptionnels
  // ============================================================================
  const isWhitelisted = hasRole(roles, 'vip') || hasRole(roles, 'admin');

  // Vérification directe du profil comme fallback (si roles pas encore chargés)
  const ACTIVE_PLANS = ['starter', 'pro', 'studio', 'enterprise', 'admin'];
  const hasDirectPlanAccess = profile?.status === 'active' && 
                              profile?.plan && 
                              ACTIVE_PLANS.includes(profile.plan.toLowerCase());

  // Flags effectifs pour la navigation (whitelist ou autorisé normalement)
  const effectiveIsAuthorized = isAuthorized || isWhitelisted;
  const effectiveIsAdmin = isAdmin; // Admin déjà calculé dans useAuth
  const hasAccess = effectiveIsAuthorized || allowPending;
  
  console.log('[ProtectedRoute] Plan check:', {
    email: user?.email,
    status: profile?.status,
    plan: profile?.plan,
    hasActivePlan,
    isWhitelisted,
    requireActivePlan,
  });

  useEffect(() => {
    if (requireAdmin && user && !effectiveIsAdmin && !checkingAdmin) {
      setCheckingAdmin(true);
      refreshProfile().finally(() => setCheckingAdmin(false));
    }
  }, [requireAdmin, user, effectiveIsAdmin, checkingAdmin, refreshProfile]);

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen gradient-subtle flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <div className="text-lg font-medium text-muted-foreground">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Priorité 1: Route admin requise
  if (requireAdmin && !effectiveIsAdmin) {
    console.debug('[ProtectedRoute] Admin required but user is not admin, redirecting to /dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  // Priorité 2: Vérifier si un plan actif est requis
  if (requireActivePlan && !hasActivePlan && !isWhitelisted && !hasDirectPlanAccess) {
    console.debug('[ProtectedRoute] No active plan, redirecting to /billing', {
      email: user?.email,
      plan: profile?.plan,
      status: profile?.status,
    });
    
    // Afficher un toast pour expliquer le blocage (ID unique pour éviter doublons)
    toast.error(
      'Abonnement requis',
      {
        id: 'subscription-required',
        description: 'Pour accéder à la plateforme, tu dois avoir un abonnement actif. Choisis ton plan pour continuer avec Alfie 🐶',
        duration: 6000,
      }
    );
    
    return <Navigate to="/billing" replace />;
  }

  // Priorité 3: Vérifier les accès généraux (abonnement/autorisation)
  if (!hasAccess && !hasDirectPlanAccess) {
    console.debug('[ProtectedRoute] Access denied, redirecting to /billing', {
      email: user?.email,
      effectiveIsAuthorized,
      allowPending,
      isWhitelisted,
      hasDirectPlanAccess,
    });
    
    // Afficher un toast pour expliquer le blocage (ID unique pour éviter doublons)
    toast.error(
      'Abonnement requis',
      {
        id: 'subscription-required',
        description: 'Pour accéder à la plateforme, tu dois avoir un abonnement actif. Choisis ton plan pour continuer avec Alfie 🐶',
        duration: 6000,
      }
    );
    
    return <Navigate to="/billing" replace />;
  }

  // Note: On ne redirige JAMAIS vers /onboarding/activate ici pour les admins whitelistes
  console.debug('[ProtectedRoute] Access granted', {
    email: user?.email,
    effectiveIsAdmin,
    effectiveIsAuthorized,
    allowPending,
    isWhitelisted,
  });

  return <>{children}</>;
}
