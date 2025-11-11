import { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AccessGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AccessGuard({ children, fallback }: AccessGuardProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return fallback ? <>{fallback}</> : null;
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-900/20">
          <Lock className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-700 dark:text-orange-300 font-semibold">
            Connexion requise
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300 mt-2">
            Utilisateur non connecté. Veuillez vous authentifier pour continuer.
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => navigate('/auth')} variant="default">
                Se connecter
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
