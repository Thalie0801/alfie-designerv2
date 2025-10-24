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
import { supabase } from '@/integrations/supabase/client';
import { getAuthHeader } from '@/lib/auth';

const authSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe minimum 6 caractères" }),
  fullName: z.string().min(2, { message: "Nom requis" }).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [canSignUp, setCanSignUp] = useState(false);
  const warnedAboutSignupRedirect = useRef(false);

  // Vérifier si l'utilisateur vient d'un paiement
  const sessionId = searchParams.get('session_id');
  const paymentStatus = searchParams.get('payment');
  const hasPaymentSession = Boolean(sessionId && paymentStatus === 'success');
  const searchKey = searchParams.toString();

  // Check for payment success
  useEffect(() => {
    if (hasPaymentSession && sessionId) {
      setVerifyingPayment(true);
      verifyPayment(sessionId);
    } else {
      setCanSignUp(false);
      setMode('login');
    }
  }, [hasPaymentSession, sessionId]);

  // Empêche l'accès manuel au mode inscription sans paiement
  useEffect(() => {
    const requestedMode = searchParams.get('mode');

    if (requestedMode === 'signup') {
      if (canSignUp) {
        setMode('signup');
        warnedAboutSignupRedirect.current = false;
      } else if (!warnedAboutSignupRedirect.current) {
        warnedAboutSignupRedirect.current = true;
        toast.error('Veuillez choisir un plan avant de créer un compte.');
        redirectToPricing();
      }
    } else {
      warnedAboutSignupRedirect.current = false;
    }
  }, [searchKey, canSignUp]);

  useEffect(() => {
    if (!canSignUp && mode === 'signup') {
      setMode('login');
    }
  }, [canSignUp, mode]);

  const verifyPayment = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId },
        headers: await getAuthHeader(),
      });

      if (error) throw error;

      toast.success(`Paiement confirmé ! Plan ${data.plan} activé.`);

      setCanSignUp(true);

      // Redirect to signup if not logged in
      if (!user) {
        setMode('signup');
        if (data.email) {
          setEmail(data.email);
        }
      } else {
        // Already logged in, redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      toast.error('Erreur lors de la vérification du paiement');
      setCanSignUp(false);
      setMode('login');
    } finally {
      setVerifyingPayment(false);
    }
  };

  // Redirect if already logged in (will be handled by ProtectedRoute)
  useEffect(() => {
    if (user && !verifyingPayment) {
      navigate('/dashboard');
    }
  }, [user, verifyingPayment, navigate]);

  const redirectToPricing = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/#pricing';
    } else {
      navigate('/#pricing');
    }
  };

  const handleModeChange = (nextMode: 'login' | 'signup') => {
    if (nextMode === 'signup' && !canSignUp) {
      toast.error('Veuillez choisir un plan avant de créer un compte.');
      redirectToPricing();
      return;
    }

    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'signup' && !canSignUp) {
      toast.error('Veuillez choisir un plan avant de créer un compte.');
      redirectToPricing();
      setMode('login');
      return;
    }

    setLoading(true);

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
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email ou mot de passe incorrect');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Veuillez confirmer votre email avant de vous connecter');
          } else if (error.message.includes('User not found')) {
            toast.error('Aucun compte trouvé avec cet email. Découvrez nos offres pour vous inscrire.');
            redirectToPricing();
          } else {
            toast.error(`Erreur de connexion: ${error.message}`);
          }
        } else {
          toast.success('Connexion réussie !');
          // Redirection gérée par le state change de auth
        }
      } else {
        const { error } = await signUp(data.email, data.password, fullName);
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already registered')) {
            toast.error('Cet email est déjà enregistré. Essayez de vous connecter.');
            setMode('login');
          } else if (error.message.includes('Password should be')) {
            toast.error('Le mot de passe doit contenir au moins 6 caractères');
          } else if (error.message.includes('Unable to validate email')) {
            toast.error('Email invalide');
          } else {
            toast.error('Impossible de créer le compte pour le moment. Merci de réessayer ou de contacter le support.');
          }
        } else {
          toast.success('Compte créé avec succès ! Bienvenue 🎉');
          // Redirection gérée par le state change de auth
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Sparkles className="h-6 w-6" />
            </span>
          </div>
          <CardTitle className="text-2xl">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' 
              ? 'Connectez-vous pour accéder à Alfie Designer'
              : 'Commencez à créer vos visuels avec Alfie'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifyingPayment && (
            <Alert className="mb-4 border-green-500/50 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Vérification de votre paiement en cours...
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {mode === 'signup' && (
              <div>
                <Input
                  placeholder="Nom complet"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === 'signup'}
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
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => toast.info('Fonctionnalité bientôt disponible')}
                  className="text-xs text-primary hover:underline mt-1 block text-right"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (mode === 'signup' && !canSignUp)}
            >
              {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <p>
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => handleModeChange('signup')}
                  className={`text-primary font-medium ${
                    canSignUp ? 'hover:underline' : 'cursor-not-allowed opacity-60'
                  }`}
                  aria-disabled={!canSignUp}
                >
                  S'inscrire
                </button>
              </p>
            ) : (
              <p>
                Déjà un compte ?{' '}
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="text-primary hover:underline font-medium"
                >
                  Se connecter
                </button>
              </p>
            )}
          </div>

          {!canSignUp && (
            <div className="mt-3 text-center text-xs text-slate-500">
              <p>
                L'inscription est réservée aux clients ayant validé un paiement.{' '}
                <button
                  type="button"
                  onClick={redirectToPricing}
                  className="font-medium text-primary hover:underline"
                >
                  Voir les offres
                </button>
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-sm"
            >
              ← Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
