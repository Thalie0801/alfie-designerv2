import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, hasActivePlan, loading, refreshProfile } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  useEffect(() => {
    if (requireAdmin && user && !isAdmin && !checkingAdmin) {
      setCheckingAdmin(true);
      refreshProfile().finally(() => setCheckingAdmin(false));
    }
  }, [requireAdmin, user, isAdmin, checkingAdmin, refreshProfile]);

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

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/app" replace />;
  }

  // Vérifier si l'utilisateur a un plan actif (sauf pour les admins)
  if (!isAdmin && !hasActivePlan) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
