import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, CreditCard, LifeBuoy } from 'lucide-react';

export default function ActivateAccess() {
  const navigate = useNavigate();
  const { profile, isAuthorized } = useAuth();

  useEffect(() => {
    if (isAuthorized) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthorized, navigate]);

  const status = profile?.status ?? 'pending';

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Active ton accès à Alfie</CardTitle>
                <CardDescription>
                  Finalise ton abonnement pour débloquer la génération de visuels et de vidéos.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Statut actuel</span>
              <Badge variant={status === 'active' ? 'default' : 'secondary'} className="uppercase tracking-wide">
                {status === 'active' ? 'Actif' : 'En attente'}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-muted/40 border-dashed">
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-5 w-5" />
                    Choisir un plan
                  </CardTitle>
                  <CardDescription>
                    Sélectionne le plan qui correspond à ton usage et accède immédiatement à toutes les fonctionnalités premium.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate('/billing')} className="w-full">
                    Voir les offres et payer
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-muted/40 border-dashed">
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LifeBuoy className="h-5 w-5" />
                    Besoin d'aide ?
                  </CardTitle>
                  <CardDescription>
                    L'équipe peut t'accompagner pour activer ton accès ou t'ajouter manuellement si nécessaire.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => navigate('/contact')} className="w-full">
                    Contacter le support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
