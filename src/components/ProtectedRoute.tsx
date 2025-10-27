import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { isVipOrAdmin, isAdmin as isAdminEmail } from '@/lib/access';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowPending?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, isAuthorized, loading, refreshProfile } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // ============================================================================
  // LOGIQUE WHITELIST: Accès dashboard forcé pour comptes exceptionnels
  // ============================================================================
  const isWhitelisted = isVipOrAdmin(user?.email);

  // Flags effectifs pour la navigation (whitelist ou autorisé normalement)
  const effectiveIsAuthorized = isAuthorized || isWhitelisted;
  const effectiveIsAdmin = isAdmin || isAdminEmail(user?.email); // Admin garde toujours la priorité

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
    console.debug('[ProtectedRoute] Admin required but user is not admin, redirecting to /app');
    return <Navigate to="/app" replace />;
  }

  // Priorité 2: Admin général → toujours /admin si pas déjà sur une route admin
  if (effectiveIsAdmin && requireAdmin === false) {
    // Laisser passer, l'admin peut accéder aux routes normales
  }

  // Note: On ne redirige JAMAIS vers /onboarding/activate ici
  // La redirection onboarding est gérée uniquement dans Auth.tsx après login
  // Une fois dans l'app, les utilisateurs whitelist (Sandrine/Patricia) 
  // sont traités comme autorisés grâce à effectiveIsAuthorized
  console.debug('[ProtectedRoute] Access granted', {
    email: user?.email,
    effectiveIsAdmin,
    effectiveIsAuthorized,
    isWhitelisted
  });

  return <>{children}</>;
}
