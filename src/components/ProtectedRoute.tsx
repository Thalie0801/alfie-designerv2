import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading, refreshProfile } = useAuth();
  const location = useLocation();
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

  // Allow Studio plan users to access dashboard without restrictions
  const hasStudioPlan = user?.email && [
    'borderonpatricia7@gmail.com',
    'Sandrine.guedra@gmail.com'
  ].includes(user.email);

  // If special testers hit /billing, redirect them to dashboard
  if (hasStudioPlan && location.pathname === '/billing') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
