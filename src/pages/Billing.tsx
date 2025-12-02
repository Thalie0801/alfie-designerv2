import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, Settings, Sparkles, Award, RefreshCw, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { useCustomerPortal } from '@/hooks/useCustomerPortal';
import { useWoofsPack, WOOFS_PACKS } from '@/hooks/useWoofsPack';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { safeWoofs } from '@/lib/woofs';

const plans = [
  {
    name: 'Starter',
    key: 'starter',
    price: '39€',
    quota_woofs: 150,
    features: [
      '≈ 150 Woofs créatifs / mois',
      'Exemple : jusqu\'à 120 visuels ou 100 visuels + 8 vidéos courtes',
      '1 marque avec votre brand kit (couleurs, polices, logos, mood)',
      'Génération d\'images, carrousels et vidéos animées',
      'Export ZIP des créations prêtes à télécharger',
    ],
    popular: false
  },
  {
    name: 'Pro',
    key: 'pro',
    price: '99€',
    quota_woofs: 450,
    features: [
      '≈ 450 Woofs créatifs / mois',
      'Exemple : jusqu\'à 350 visuels ou 280 visuels + 28 vidéos courtes',
      '1 marque avec votre brand kit enrichi (palettes, ton de voix, assets récurrents)',
      'Flows complets images + carrousels + vidéos',
      'Export ZIP optimisé pour réutiliser vos contenus',
      'Support prioritaire',
    ],
    popular: true
  },
  {
    name: 'Studio',
    key: 'studio',
    price: '199€',
    quota_woofs: 1000,
    features: [
      '≈ 1000 Woofs créatifs / mois',
      'Exemple : jusqu\'à 800 visuels ou 650 visuels + 58 vidéos courtes',
      '1 marque avec votre brand kit complet (templates, presets, visuels piliers…)',
      'Export Canva + packs ZIP pour livrer vite à vos clients',
      'Bibliothèque longue durée + priorité de génération',
      'Support dédié',
    ],
    popular: false
  },
  {
    name: 'Enterprise',
    key: 'enterprise',
    price: null,
    quota_woofs: 999999,
    features: [
      'Woofs illimités',
      'Marques illimitées',
      'Tout débloquer',
      'Export Canva + API',
      'Stockage personnalisé',
      'API & SSO',
      'White-label',
      'Support dédié 24/7',
      'Formation personnalisée'
    ],
    popular: false,
    isEnterprise: true
  }
];

export default function Billing() {
  const { profile, user, refreshProfile, isAdmin, loading: authLoading } = useAuth();
  const { createCheckout, loading } = useStripeCheckout();
  const { openCustomerPortal, loading: portalLoading } = useCustomerPortal();
  const { purchaseWoofsPack, loading: woofsLoading } = useWoofsPack();
  const [searchParams] = useSearchParams();
  const preselectedPlan = searchParams.get('plan');
  const currentPlan = profile?.plan || null;
  const hasActivePlan = Boolean(profile?.status === 'active' || profile?.granted_by_admin);
  const isAmbassador = profile?.granted_by_admin;
  const hasStripeSubscription = profile?.stripe_subscription_id;
  const activeBrandId = profile?.active_brand_id;
  
  const [woofsData, setWoofsData] = useState<{
    used: number;
    quota: number;
    remaining: number;
  } | null>(null);
  const [loadingWoofs, setLoadingWoofs] = useState(true);

  // Charger les Woofs
  const fetchWoofs = async () => {
    if (!profile?.active_brand_id) {
      setLoadingWoofs(false);
      return;
    }

    try {
      setLoadingWoofs(true);
      const { data, error } = await supabase.functions.invoke("get-quota", {
        body: { brand_id: profile.active_brand_id },
      });

      console.log("[Billing] get-quota response:", { data, error });

      // get-quota retourne directement les champs (pas wrappés dans data.data)
      if (!error && data) {
        setWoofsData({
          used: safeWoofs(data.woofs_used),
          quota: safeWoofs(data.woofs_quota),
          remaining: safeWoofs(data.woofs_remaining),
        });
      }
    } catch (err) {
      console.error("[Billing] Error fetching woofs:", err);
    } finally {
      setLoadingWoofs(false);
    }
  };

  // Ensure fresh profile on page load (avoids stale plan state)
  useEffect(() => {
    refreshProfile();
    fetchWoofs();
    
    // Scroll automatiquement vers le plan pré-sélectionné
    if (preselectedPlan) {
      setTimeout(() => {
        const planCard = document.getElementById(`plan-${preselectedPlan}`);
        planCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.active_brand_id, preselectedPlan]);

  const handleSelectPlan = async (plan: typeof plans[0]) => {
    if (plan.isEnterprise) {
      window.location.href = '/contact';
      return;
    }

    if (!user) {
      toast.error('Vous devez être connecté pour souscrire à un abonnement');
      return;
    }
    
    await createCheckout(plan.key as 'starter' | 'pro' | 'studio' | 'enterprise');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => (window.location.href = '/app')}>
          ← Retour
        </Button>
        <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/dashboard')}>
          Aller au dashboard
        </Button>
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Abonnement
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gérez votre plan et votre facturation
        </p>
        {user?.email && (
          <p className="text-sm text-muted-foreground mt-1">
            Connecté en tant que: <span className="font-medium">{user.email}</span>
          </p>
        )}
      </div>

      {preselectedPlan && !hasActivePlan && (
        <Alert className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Finalise ton abonnement</AlertTitle>
          <AlertDescription className="text-blue-700">
            Tu as choisi le plan <strong>{preselectedPlan.charAt(0).toUpperCase() + preselectedPlan.slice(1)}</strong>. 
            Clique sur le bouton ci-dessous pour procéder au paiement.
          </AlertDescription>
        </Alert>
      )}

      {!authLoading && isAdmin && (
        <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <Sparkles className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Accès Administrateur</AlertTitle>
          <AlertDescription className="text-green-700">
            Vous avez un accès administrateur avec toutes les fonctionnalités.
          </AlertDescription>
        </Alert>
      )}

      {!authLoading && !isAdmin && isAmbassador && (
        <Alert className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <Award className="h-4 w-4 text-purple-600" />
          <AlertTitle className="text-purple-800">🎖️ Accès Ambassadeur</AlertTitle>
          <AlertDescription className="text-purple-700">
            Vous disposez d'un accès {currentPlan?.toUpperCase()} Ambassadeur.
          </AlertDescription>
        </Alert>
      )}

      {!isAdmin && !isAmbassador && currentPlan && currentPlan !== 'none' && (
        <Alert className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Plan actuel : {currentPlan.toUpperCase()}</AlertTitle>
          <AlertDescription className="text-blue-700">
            Votre abonnement est actif. Gérez votre abonnement ci-dessous.
          </AlertDescription>
        </Alert>
      )}


      {/* Current Plan */}
      {hasActivePlan && (
        <Card className="border-primary/30 shadow-medium gradient-subtle">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 mb-2">
                  <Badge className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 text-base">
                    Plan actuel: {currentPlan}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Profitez de tous les avantages de votre abonnement
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchWoofs}
                  disabled={loadingWoofs}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingWoofs ? 'animate-spin' : ''}`} />
                </Button>
                {hasStripeSubscription && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openCustomerPortal}
                    disabled={portalLoading}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {portalLoading ? 'Chargement...' : 'Gérer'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="bg-card/50">
            <div className="space-y-3">
              {/* Compteur Woofs unifié */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🐾</span>
                  <div>
                    <p className="font-semibold text-orange-700 dark:text-orange-300">Woofs ce mois</p>
                    <p className="text-xs text-orange-600/70 dark:text-orange-400/70">
                      1 Woof = 1 image/slide · 25 Woofs = 1 asset vidéo (6s)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {loadingWoofs ? (
                    <div className="text-orange-600 dark:text-orange-400 font-bold">Chargement...</div>
                  ) : woofsData ? (
                    <>
                      <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                        {woofsData.used} / {woofsData.quota}
                      </div>
                      <div className="text-xs text-orange-600/80 dark:text-orange-400/80">
                        {woofsData.remaining} restants
                      </div>
                    </>
                  ) : (
                    <div className="text-orange-600 dark:text-orange-400">-</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recharger Woofs - Section pour acheter des packs */}
      {hasActivePlan && activeBrandId && (
        <Card className="border-orange-200 dark:border-orange-800 shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Zap className="h-5 w-5" />
              Recharger tes Woofs 🐶
            </CardTitle>
            <CardDescription>
              Besoin de plus de crédits ? Achète un pack de Woofs supplémentaires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {WOOFS_PACKS.map((pack) => (
                <div
                  key={pack.size}
                  className={cn(
                    "relative p-4 rounded-lg border-2 transition-colors bg-gradient-to-br",
                    pack.bonus 
                      ? "border-emerald-400 dark:border-emerald-600 hover:border-emerald-500 from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30" 
                      : "border-orange-200 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-500 from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20"
                  )}
                >
                  {pack.bonus && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs px-2 py-0.5 shadow-md">
                      +{pack.bonus} GRATUITS
                    </Badge>
                  )}
                  <div className="text-center space-y-2">
                    <div className={cn(
                      "text-3xl font-bold",
                      pack.bonus ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
                    )}>
                      {pack.size}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {pack.bonus ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">= {pack.actualWoofs} Woofs</span>
                      ) : (
                        "Woofs"
                      )}
                    </div>
                    <div className="text-lg font-semibold text-foreground">
                      {pack.price}€
                    </div>
                    <Button
                      size="sm"
                      variant={pack.bonus ? "default" : "outline"}
                      className={cn(
                        "w-full",
                        pack.bonus 
                          ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white" 
                          : "border-orange-300 hover:bg-orange-100 dark:border-orange-600 dark:hover:bg-orange-900/30"
                      )}
                      onClick={() => purchaseWoofsPack(activeBrandId, pack.size)}
                      disabled={woofsLoading}
                    >
                      {woofsLoading ? 'Chargement...' : 'Acheter'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Les Woofs achetés s'ajoutent à ton quota mensuel et n'expirent jamais.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {plans.map((plan) => {
          const planColors = {
            'Starter': 'from-orange-500 to-red-500',
            'Pro': 'from-green-500 to-teal-500',
            'Studio': 'from-blue-500 to-purple-500',
            'Enterprise': 'from-purple-500 to-pink-500'
          }[plan.name] || 'from-gray-500 to-gray-600';
          
          const isCurrentPlan = currentPlan === plan.key;
          
          return (
            <Card
              key={plan.name}
              id={`plan-${plan.key}`}
              className={cn(
                "relative hover:scale-105 transition-all",
                plan.popular && "border-primary border-2 shadow-strong",
                isCurrentPlan && "border-primary shadow-lg scale-105",
                preselectedPlan === plan.key && !isCurrentPlan && "ring-2 ring-primary animate-pulse",
                !plan.popular && !isCurrentPlan && "shadow-medium"
              )}
            >
              {isCurrentPlan && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  Votre plan actuel
                </Badge>
              )}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`bg-gradient-to-r ${planColors} bg-clip-text text-transparent`}>
                    {plan.name}
                  </CardTitle>
                  {plan.popular && <Badge className="bg-gradient-to-r from-primary to-secondary text-white">⭐ Populaire</Badge>}
                </div>
              <CardDescription>
                {plan.price ? (
                  <>
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{plan.price}</span>
                    <span className="text-muted-foreground"> / mois</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-primary">Nous contacter</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className={`w-full ${plan.popular ? 'gradient-hero text-white shadow-medium' : ''}`}
                variant={plan.popular ? 'default' : 'outline'}
                disabled={isCurrentPlan || loading}
                onClick={() => handleSelectPlan(plan)}
              >
                {plan.isEnterprise 
                  ? '📧 Nous contacter' 
                  : isCurrentPlan 
                  ? '✓ Plan actuel' 
                  : loading 
                  ? 'Chargement...' 
                  : `Choisir ${plan.name}`}
              </Button>
            </CardFooter>
          </Card>
        )})}
      </div>
    </div>
  );
}
