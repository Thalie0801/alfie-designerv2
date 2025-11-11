import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { hasRole } from '@/lib/access';
import { useRoles } from '@/hooks/useRoles';

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
  const { isAdmin: profileIsAdmin, loading: rolesLoading } = useRoles();
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // ============================================================================
  // LOGIQUE WHITELIST: Accès dashboard forcé pour comptes exceptionnels
  // ============================================================================
  const isWhitelisted = hasRole(roles, 'vip') || hasRole(roles, 'admin');

  // Flags effectifs pour la navigation (whitelist ou autorisé normalement)
  const effectiveIsAuthorized = isAuthorized || isWhitelisted;
  const effectiveIsAdmin = isAdmin || profileIsAdmin;
  const hasAccess = effectiveIsAuthorized || allowPending;

  useEffect(() => {
    if (requireAdmin && user && !effectiveIsAdmin && !checkingAdmin) {
      setCheckingAdmin(true);
      refreshProfile().finally(() => setCheckingAdmin(false));
    }
  }, [requireAdmin, user, effectiveIsAdmin, checkingAdmin, refreshProfile]);

  const waitingForAdmin = requireAdmin && (rolesLoading || checkingAdmin);

  if (loading || waitingForAdmin) {
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

  // Vérifier les accès généraux (abonnement/autorisation)
  if (!hasAccess) {
    console.debug('[ProtectedRoute] Access denied, redirecting to /onboarding/activate', {
      email: user?.email,
      effectiveIsAuthorized,
      allowPending,
      isWhitelisted,
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
