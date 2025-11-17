import { useState, useEffect, useRef, useCallback } from 'react';
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
import { hasRole } from '@/lib/access';
import { ProspectBubble } from '@/components/ProspectBubble';

const authSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe minimum 6 caractères" }),
  fullName: z.string().min(2, { message: "Nom requis" }).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn, signUp, user, isAdmin, isAuthorized, roles, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [canSignUp, setCanSignUp] = useState(false);
  const warnedAboutSignupRedirect = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Déterminer si les flags auth sont prêts (pas undefined)
  const flagsReady = typeof isAdmin === 'boolean' && typeof isAuthorized === 'boolean';

  // ============================================================================
  // LOGIQUE WHITELIST: Accès dashboard forcé pour comptes exceptionnels
  // ============================================================================
  const isWhitelisted = hasRole(roles, 'vip') || hasRole(roles, 'admin');

  // Flags effectifs pour la navigation (whitelist ou autorisé normalement)
  const effectiveIsAuthorized = isAuthorized || isWhitelisted;
  const effectiveIsAdmin = isAdmin; // Admin déjà calculé dans useAuth

  // Vérifier si l'utilisateur vient d'un paiement
  const sessionId = searchParams.get('session_id');
  const paymentStatus = searchParams.get('payment');
  const hasPaymentSession = Boolean(sessionId && paymentStatus === 'success');
  const searchKey = searchParams.toString();

  // Nettoyer les paramètres de paiement après traitement
  const stripPaymentParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session_id');
    next.delete('payment');
    next.delete('mode');
    setSearchParams(next, { replace: true });
    console.debug('[Auth] Cleaned payment params from URL');
  }, [searchParams, setSearchParams]);

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

  // Navigation après authentification - PRIORITÉ: Admin > Whitelist/Authorized > Onboarding
  const navigateAfterAuth = useCallback(() => {
    console.debug('[Auth redirect] Navigating after auth', {
      email: user?.email,
      isAdmin: effectiveIsAdmin,
      isAuthorized,
      isWhitelisted,
      effectiveIsAuthorized,
      flagsReady,
      vipBypass: isWhitelisted ? 'VIP ACCESS GRANTED' : 'no bypass'
    });
    
    // 1. Admin d'abord (priorité absolue)
    if (effectiveIsAdmin) {
      console.debug('[Auth redirect] → /admin (admin user)');
      return navigate('/admin');
    }
    
    // 2. Comptes whitelist (Sandrine/Patricia) ou users autorisés normalement
    if (effectiveIsAuthorized) {
      console.debug('[Auth redirect] → /dashboard (authorized or whitelisted)');
      return navigate('/dashboard');
    }
    
    // 3. Sinon onboarding
    console.debug('[Auth redirect] → /onboarding/activate (not authorized)');
    return navigate('/onboarding/activate');
  }, [effectiveIsAdmin, effectiveIsAuthorized, isAuthorized, isWhitelisted, navigate, user?.email, flagsReady]);

  // Vérification du paiement (useCallback stable)
  const verifyPayment = useCallback(async (sessionId: string) => {
    if (!isMountedRef.current) return;
    
    setVerifyingPayment(true);
    console.debug('[Auth] Starting payment verification', { sessionId });

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId },
      });

      if (error) {
        console.error('[Auth] Payment verification error:', error);
        throw error;
      }

      if (!isMountedRef.current) return;

      // Gestion des codes d'erreur structurés si disponibles
      const errorCode = data?.code;
      const plan = data?.plan;
      const customerEmail = data?.email;

      if (errorCode) {
        // Gérer les codes d'erreur structurés
        switch (errorCode) {
          case 'PAYMENT_NOT_COMPLETED':
            toast.error('Le paiement n\'a pas été complété');
            break;
          case 'INVALID_PLAN':
            toast.error('Plan invalide dans la session de paiement');
            break;
          case 'SESSION_NOT_FOUND':
            toast.error('Session de paiement introuvable');
            break;
          default:
            toast.error(data?.message || 'Erreur lors de la vérification du paiement');
        }
        setCanSignUp(false);
        setMode('login');
        return;
      }

      console.debug('[Auth] Payment verified successfully', { plan, email: customerEmail });
      toast.success(`Paiement confirmé ! Plan ${plan || ''} activé.`);

      setCanSignUp(true);

      // Si pas connecté, basculer en mode inscription avec email pré-rempli
      if (!user) {
        console.debug('[Auth] User not logged in, switching to signup mode');
        setMode('signup');
        if (customerEmail) {
          setEmail(customerEmail);
        }
      } else {
        // Si déjà connecté, naviguer selon les rôles
        console.debug('[Auth] User already logged in, navigating');
        navigateAfterAuth();
      }

      // Nettoyer l'URL après succès
      stripPaymentParams();
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      console.error('[Auth] Payment verification failed:', error);
      
      // Gestion d'erreur robuste (ne pas se baser uniquement sur message.includes)
      const errorMsg = error?.message || 'Erreur inconnue';
      toast.error(`Erreur lors de la vérification du paiement: ${errorMsg}`);
      
      setCanSignUp(false);
      setMode('login');
    } finally {
      if (isMountedRef.current) {
        setVerifyingPayment(false);
      }
    }
  }, [user, navigateAfterAuth, stripPaymentParams]);

  // Check for payment success (vérifie une seule fois au montage ou changement de sessionId)
  useEffect(() => {
    if (hasPaymentSession && sessionId) {
      console.debug('[Auth] Payment session detected, verifying...');
      verifyPayment(sessionId);
    } else {
      setCanSignUp(false);
      setMode('login');
    }
  }, [hasPaymentSession, sessionId, verifyPayment]);

  // Redirect if already logged in - ATTENDRE que les flags soient prêts
  useEffect(() => {
    if (!authLoading && !verifyingPayment && user && flagsReady) {
      console.debug('[Auth] User logged in and flags ready, navigating...', {
        email: user?.email,
        isAdmin: effectiveIsAdmin,
        isAuthorized,
        isWhitelisted,
        effectiveIsAuthorized
      });
      navigateAfterAuth();
    }
  }, [user, verifyingPayment, authLoading, flagsReady, navigateAfterAuth, effectiveIsAdmin, isAuthorized, effectiveIsAuthorized, isWhitelisted]);

  const redirectToPricing = (reason?: string) => {
    if (typeof window !== 'undefined') {
      const url = reason ? `/?reason=${encodeURIComponent(reason)}#pricing` : '/#pricing';
      window.location.href = url;
    } else {
      navigate(reason ? `/?reason=${encodeURIComponent(reason)}#pricing` : '/#pricing');
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
          
          // Gestion d'erreur robuste
          const errorMsg = error.message.toLowerCase();
          
          if (errorMsg.includes('invalid login credentials')) {
            toast.error('Email ou mot de passe incorrect');
          } else if (errorMsg.includes('email not confirmed')) {
            toast.error('Veuillez confirmer votre email avant de vous connecter');
          } else if (errorMsg.includes('user not found')) {
            toast.error('Aucun compte trouvé avec cet email. Découvrez nos offres pour vous inscrire.');
            redirectToPricing();
          } else if (errorMsg.includes('no_active_subscription')) {
            toast.error("Votre abonnement n'est pas actif. Choisissez un plan pour accéder au dashboard.");
            redirectToPricing('no-sub');
          } else {
            toast.error(`Erreur de connexion: ${error.message}`);
          }
        } else {
          console.debug('[Auth] Login successful');
          toast.success('Connexion réussie !');
          // Redirection gérée par le state change de auth
        }
      } else {
        // Mode inscription - appel à signUp
        const { error } = await signUp(data.email, data.password, data.fullName || '');
        
        if (error) {
          console.error('[Auth] Signup error:', error);
          
          const errorMsg = error.message.toLowerCase();
          
          if (errorMsg.includes('user already registered')) {
            toast.error('Cet email est déjà utilisé. Veuillez vous connecter.');
            setMode('login');
          } else if (errorMsg.includes('aucun paiement validé')) {
            toast.error('Aucun paiement validé trouvé. Veuillez choisir un plan.');
            redirectToPricing();
          } else {
            toast.error(`Erreur d'inscription: ${error.message}`);
          }
        } else {
          console.debug('[Auth] Signup successful');
          toast.success('Compte créé avec succès ! Vérifiez votre email pour confirmer.');
          // Redirection gérée automatiquement par le state change
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
  const formDisabled = loading || verifyingPayment || (mode === 'signup' && !canSignUp);

  // Show loader while checking auth state
  if (authLoading || (user && !flagsReady)) {
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
                disabled={formDisabled}
              >
                {loading || verifyingPayment ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
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
                    onClick={() => redirectToPricing()}
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
      <ProspectBubble />
    </>
  );
}
