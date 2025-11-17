import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CanvaConnectionRow {
  id: string;
  canva_user_id: string | null;
  scope: string | null;
  updated_at: string | null;
  expires_at: string | null;
}

/**
 * Display the current status of the Canva Connect integration and handles
 * the "Connect my Canva account" CTA by invoking the Supabase Edge Function.
 */
export function CanvaIntegrationCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<CanvaConnectionRow | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const loadConnection = useCallback(async () => {
    if (!user) {
      setConnection(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from('canva_connections')
      .select('id, canva_user_id, scope, updated_at, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[CanvaIntegrationCard] Failed to fetch connection', error.message);
      setErrorMessage("Impossible de récupérer l'état de la connexion Canva.");
      setConnection(null);
    } else {
      setConnection(data ?? null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConnection();
  }, [loadConnection]);

  const formattedExpiry = useMemo(() => {
    if (!connection?.expires_at) return null;
    const expiresDate = new Date(connection.expires_at);
    if (Number.isNaN(expiresDate.getTime())) return null;
    return expiresDate.toLocaleString();
  }, [connection?.expires_at]);

  const handleStartOAuth = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour associer Canva.');
      return;
    }

    setAuthLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('missing_access_token');
      }

      const { data, error } = await supabase.functions.invoke('canva-auth-start', {
        body: {},
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        throw error;
      }

      const authorizationUrl = data?.authorizationUrl;
      if (!authorizationUrl || typeof authorizationUrl !== 'string') {
        throw new Error('missing_authorization_url');
      }

      window.location.href = authorizationUrl;
    } catch (err) {
      console.error('[CanvaIntegrationCard] Unable to start Canva OAuth', err);
      toast.error('La connexion à Canva a échoué. Réessayez dans un instant.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnectClick = () => {
    toast.info('La déconnexion sera disponible prochainement.');
  };

  return (
    <Card className="border-primary/30 shadow-medium">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-primary" />
          Canva Connect
        </CardTitle>
        <CardDescription>
          Connectez votre espace Canva pour recevoir les designs directement dans votre compte.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de votre statut Canva...
          </div>
        ) : connection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500 text-white">Connecté</Badge>
              <span className="text-sm text-muted-foreground">
                Compte Canva synchronisé {connection.canva_user_id ? `(#${connection.canva_user_id})` : ''}
              </span>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              {formattedExpiry && (
                <p>
                  Token valable jusqu'au <span className="font-medium text-foreground">{formattedExpiry}</span>
                </p>
              )}
              {connection.scope && (
                <p>
                  Scopes : <span className="font-mono text-xs text-foreground">{connection.scope}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" disabled>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Protection active
              </Button>
              <Button variant="destructive" onClick={handleDisconnectClick}>
                Déconnecter (bientôt)
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aucun compte Canva connecté. Lancez l'authentification sécurisée pour permettre à Alfie de déposer vos designs.
            </p>
            <Button onClick={handleStartOAuth} disabled={authLoading} className="w-full sm:w-auto">
              {authLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connecter mon compte Canva
            </Button>
          </div>
        )}

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
