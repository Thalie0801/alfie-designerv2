import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { hasRole } from '@/lib/access';
import { useBrandKit } from '@/hooks/useBrandKit';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowPending?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  allowPending = false,
}: ProtectedRouteProps) {
  const { user, isAdmin, isAuthorized, roles, loading, refreshProfile } = useAuth();
  const { brands, activeBrandId } = useBrandKit();
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // ============================================================================
  // LOGIQUE WHITELIST: Accès dashboard forcé pour comptes exceptionnels
  // ============================================================================
  const isWhitelisted = hasRole(roles, 'vip') || hasRole(roles, 'admin');

  // Flags effectifs pour la navigation (whitelist ou autorisé normalement)
  const effectiveIsAuthorized = isAuthorized || isWhitelisted;
  const effectiveIsAdmin = isAdmin; // Admin déjà calculé dans useAuth
  const hasAccess = effectiveIsAuthorized || allowPending;

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

  // Bypass onboarding if user has at least one brand or is enterprise
  const hasBrand = Boolean(activeBrandId) || (brands?.length ?? 0) > 0;
  const isEnterprise = hasRole(roles, 'enterprise');
  
  // Vérifier les accès généraux (abonnement/autorisation)
  if (!hasAccess && !hasBrand && !isEnterprise) {
    console.debug('[ProtectedRoute] Access denied, redirecting to /onboarding/activate', {
      email: user?.email,
      effectiveIsAuthorized,
      allowPending,
      isWhitelisted,
      hasBrand,
      isEnterprise,
    });
    return <Navigate to="/onboarding/activate" replace />;
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
