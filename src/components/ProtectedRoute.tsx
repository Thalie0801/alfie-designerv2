import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

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

  // Allow Studio plan users to access dashboard without restrictions
  const hasStudioPlan = user?.email && [
    'borderonpatricia7@gmail.com',
    'Sandrine.guedra@gmail.com', 
    'b2494709@gmail.com'
  ].includes(user.email);

  // Check if user has active plan (skip for admins and studio test accounts)
  if (!isAdmin && !hasActivePlan && !hasStudioPlan) {
    return (
      <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Accès restreint</h1>
            <p className="text-muted-foreground">
              Vous devez souscrire à un plan pour accéder à Alfie Designer
            </p>
          </div>
          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/#pricing'}
            >
              Voir les plans et tarifs
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => window.location.href = '/'}
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
