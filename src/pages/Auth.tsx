import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { ProspectBubble } from '@/components/ProspectBubble';

const authSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe minimum 6 caractères" }),
  fullName: z.string().min(2, { message: "Nom requis" }).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const isMountedRef = useRef(true);

  // Lire le paramètre plan de l'URL
  const intendedPlan = searchParams.get('plan') as 'starter' | 'pro' | 'studio' | null;
  const isValidPlan = intendedPlan && ['starter', 'pro', 'studio'].includes(intendedPlan);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Redirect si déjà connecté - TOUJOURS vers /billing
  useEffect(() => {
    if (!authLoading && user) {
      if (isValidPlan) {
        // Il a cliqué sur un plan → on l'envoie sur la page de paiement de ce plan
        navigate(`/billing?plan=${intendedPlan}`);
      } else {
        // Dans tous les cas, sans contexte de plan → on l'envoie sur billing
        navigate('/billing');
      }
    }
  }, [user, authLoading, isValidPlan, intendedPlan, navigate]);

  const handleModeChange = (nextMode: 'login' | 'signup' | 'reset') => {
    setMode(nextMode);
    setResetEmailSent(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Veuillez entrer votre email');
      return;
    }

    setLoading(true);

    try {
    const { error } = await supabase.functions.invoke('request-password-reset', {
      body: { 
        email,
        appOrigin: window.location.origin
      }
    });

      if (error) throw error;

      setResetEmailSent(true);
      toast.success('Email de réinitialisation envoyé !');
      console.log('[Auth] Password reset email sent to:', email);
    } catch (error: any) {
      console.error('[Auth] Password reset error:', error);
      toast.error(error.message || 'Erreur lors de l\'envoi de l\'email');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.debug('[Auth] Form submission started', { mode, email });

    try {
      // Validate
      const data = authSchema.parse({
        email,
        password,
        fullName: mode === 'signup' ? fullName : undefined
      });

      if (mode === 'login') {
        const { error } = await signIn(data.email, data.password);
        if (error) {
          console.error('[Auth] Login error:', error);
          const errorMsg = error.message.toLowerCase();
          
          if (errorMsg.includes('invalid login credentials')) {
            toast.error('Email ou mot de passe incorrect');
          } else if (errorMsg.includes('email not confirmed')) {
            toast.error('Veuillez confirmer votre email avant de vous connecter');
          } else {
            toast.error(`Erreur de connexion: ${error.message}`);
          }
        } else {
          console.debug('[Auth] Login successful');
          toast.success('Connexion réussie !');
          // Redirection gérée par le useEffect ci-dessus
        }
      } else {
        // Mode inscription
        const { error } = await signUp(data.email, data.password, data.fullName || '');
        
        if (error) {
          console.error('[Auth] Signup error:', error);
          const errorMsg = error.message.toLowerCase();
          
          if (errorMsg.includes('user already registered')) {
            toast.error('Cet email est déjà utilisé. Veuillez vous connecter.');
            setMode('login');
          } else {
            toast.error(`Erreur d'inscription: ${error.message}`);
          }
        } else {
          console.debug('[Auth] Signup successful');
          toast.success('Compte créé avec succès !');
          // Redirection gérée par le useEffect ci-dessus
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('[Auth] Unexpected error:', error);
        toast.error('Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  // Déterminer si le formulaire doit être désactivé
  const formDisabled = loading;

  // Show loader while checking auth state
  if (authLoading) {
    return (
      <>
        <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                <p className="text-muted-foreground">Vérification de votre session...</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <ProspectBubble />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Sparkles className="h-6 w-6" />
              </span>
            </div>
            <CardTitle className="text-2xl">
              {mode === 'reset' ? 'Mot de passe oublié' : mode === 'login' ? 'Connexion' : 'Créer un compte'}
            </CardTitle>
            <CardDescription>
              {mode === 'reset' 
                ? 'Entrez votre email pour recevoir un lien de réinitialisation'
                : mode === 'login'
                ? 'Connectez-vous pour accéder à Alfie Designer'
                : 'Commencez à créer vos visuels avec Alfie'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isValidPlan && (
              <Alert className="mb-4 border-primary/50 bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  Tu as choisi le plan <strong>{intendedPlan!.charAt(0).toUpperCase() + intendedPlan!.slice(1)}</strong>.
                  Crée ton compte ou connecte-toi pour finaliser ton abonnement.
                </AlertDescription>
              </Alert>
            )}

            {mode === 'reset' && resetEmailSent && (
              <Alert className="mb-4 border-green-500/50 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Email envoyé ! Vérifiez votre boîte de réception.
                </AlertDescription>
              </Alert>
            )}

            {mode === 'reset' ? (
              <form onSubmit={handlePasswordReset} className="space-y-4 mt-6">
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Envoi...' : 'Envoyer le lien'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode('login')}
                  disabled={loading}
                >
                  Retour à la connexion
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              {mode === 'signup' && (
                <div>
                  <Input
                    placeholder="Nom complet"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={mode === 'signup'}
                    disabled={formDisabled}
                  />
                </div>
              )}
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={formDisabled}
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={formDisabled}
                />
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-xs text-primary hover:underline mt-1 block text-right"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={formDisabled}
              >
                {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </Button>
            </form>
            )}

            <div className="mt-4 text-center text-sm">
              {mode === 'reset' ? null : mode === 'login' ? (
                <p>
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('signup')}
                    className="font-medium text-primary hover:underline"
                  >
                    Créer un compte
                  </button>
                </p>
              ) : (
                <p>
                  Déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="font-medium text-primary hover:underline"
                  >
                    Se connecter
                  </button>
                </p>
              )}
            </div>

            {mode !== 'reset' && (
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/'}
                  className="text-muted-foreground"
                >
                  ← Retour à l'accueil
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ProspectBubble />
    </>
  );
}
