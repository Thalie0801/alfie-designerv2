import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CreditPurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [creditsAdded, setCreditsAdded] = useState(0);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      toast.error('Session invalide');
      navigate('/billing');
      return;
    }

    verifyPurchase(sessionId);
  }, [searchParams, navigate]);

  const verifyPurchase = async (sessionId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('verify-credit-purchase', {
        body: { session_id: sessionId },
        headers: session?.session ? {
          Authorization: `Bearer ${session.session.access_token}`,
        } : {},
      });

      if (error) throw error;

      if (data?.success) {
        setCreditsAdded(data.credits_added);
        toast.success(`${data.credits_added} crédits ajoutés avec succès !`);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error('Erreur lors de la vérification du paiement');
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <CardTitle>Vérification du paiement...</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Nous vérifions votre paiement. Cela ne prend que quelques secondes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12">
      <Card className="border-green-500/50 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <div>
              <CardTitle className="text-2xl text-green-700 dark:text-green-400">
                Achat réussi !
              </CardTitle>
              <CardDescription>
                Tes crédits ont été ajoutés à ton compte
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="text-center">
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                Crédits ajoutés
              </p>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                +{creditsAdded} crédits
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/app')}
              className="flex-1"
              size="lg"
            >
              Commencer à créer
            </Button>
            <Button
              onClick={() => navigate('/billing')}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              Retour à l'abonnement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
