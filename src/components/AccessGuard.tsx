import { ReactNode } from 'react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Composant de garde pour protéger les fonctionnalités payantes
 * Bloque l'accès si l'utilisateur n'a pas :
 * - Un abonnement Stripe actif
 * - OU un accès manuel (granted_by_admin)
 */
export function AccessGuard({ children, fallback }: AccessGuardProps) {
  const { hasAccess, loading, reason } = useAccessControl();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-900/20">
          <Lock className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-700 dark:text-orange-300 font-semibold">
            Accès réservé aux membres actifs
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300 mt-2">
            {reason}
            <div className="mt-4 space-x-2">
              <Button onClick={() => navigate('/billing')} variant="default">
                Voir les plans
              </Button>
              <Button onClick={() => navigate('/contact')} variant="outline">
                Nous contacter
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
