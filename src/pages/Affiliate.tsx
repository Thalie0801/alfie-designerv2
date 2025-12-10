import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Copy, DollarSign, MousePointerClick, TrendingUp, Users, Award, Target, Crown, CreditCard, Package, ArrowUp, UserPlus2, BarChart3, Facebook, Instagram, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { maskEmail } from '@/utils/privacy';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Affiliate() {
  const { user, profile } = useAuth();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [directReferrals, setDirectReferrals] = useState<any[]>([]);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [editingSlug, setEditingSlug] = useState('');
  const [updatingSlug, setUpdatingSlug] = useState(false);
  const [stats, setStats] = useState({
    totalClicks: 0,
    totalConversions: 0,
    totalEarnings: 0,
    pendingPayout: 0,
    level1Earnings: 0,
    level2Earnings: 0,
    level3Earnings: 0
  });
  const [showClicksBreakdown, setShowClicksBreakdown] = useState(false);
  const [clicksBreakdown, setClicksBreakdown] = useState<{source: string, count: number}[]>([]);

  useEffect(() => {
    loadAffiliateData();
  }, [user]);

  const loadAffiliateData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const aff = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (aff.error) {
        toast.error('Accès affilié refusé', { description: aff.error.message });
        setAffiliate(null);
        return;
      }

      // Auto-create affiliate if not exists
      if (!aff.data) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          const { data: newAff, error: createError } = await supabase
            .from('affiliates')
            .insert({
              id: user.id,
              email: user.email || '',
              name: user.email?.split('@')[0] || 'Affilié',
              status: 'active',
              affiliate_status: 'creator',
              active_direct_referrals: 0
            })
            .select()
            .single();

          if (createError) {
            console.error('Failed to create affiliate:', createError);
            toast.error('Impossible de créer le compte affilié');
            setAffiliate(null);
            return;
          }

          setAffiliate(newAff);
          toast.success('Votre compte affilié a été créé automatiquement ! 🎉');

          // Continue to load stats for the new affiliate
          aff.data = newAff;
        } else {
          setAffiliate(null);
          return;
        }
      }

      if (!aff.data) {
        setAffiliate(null);
        return;
      }

      setAffiliate(aff.data);

      // Initialize editing slug
      if (aff.data.slug) {
        setEditingSlug(aff.data.slug);
      }

      const [clicks, conv, pays, comms, refs] = await Promise.all([
        supabase
          .from('affiliate_clicks')
          .select('*')
          .eq('affiliate_id', aff.data.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('affiliate_conversions')
          .select('*')
          .eq('affiliate_id', aff.data.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('affiliate_payouts')
          .select('*')
          .eq('affiliate_id', aff.data.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('affiliate_commissions')
          .select('*')
          .eq('affiliate_id', aff.data.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('affiliates')
          .select('id, name, email, created_at, affiliate_status, active_direct_referrals')
          .eq('parent_id', aff.data.id),
      ]);

      for (const r of [clicks, conv, pays, comms, refs]) {
        if ((r as any).error) {
          toast.error('Lecture refusée', { description: (r as any).error.message });
        }
      }

      setPayouts(pays.data ?? []);
      setCommissions(comms.data ?? []);
      setConversions(conv.data ?? []);
      setDirectReferrals(refs.data ?? []);

      // Calculer la répartition des clics par source UTM
      const sourceBreakdown = (clicks.data ?? []).reduce((acc, click) => {
        const source = (click as any).utm_source || 'direct';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const breakdownArray = Object.entries(sourceBreakdown)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      setClicksBreakdown(breakdownArray);

      const level1 = (comms.data ?? [])
        .filter((c: any) => c.level === 1)
        .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const level2 = (comms.data ?? [])
        .filter((c: any) => c.level === 2)
        .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const level3 = (comms.data ?? [])
        .filter((c: any) => c.level === 3)
        .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const total = level1 + level2 + level3;
      const pending = (pays.data ?? [])
        .filter((p: any) => p.status === 'pending')
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

      setStats({
        totalClicks: clicks.data?.length ?? 0,
        totalConversions: conv.data?.length ?? 0,
        totalEarnings: total,
        pendingPayout: pending,
        level1Earnings: level1,
        level2Earnings: level2,
        level3Earnings: level3,
      });
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors du chargement', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  const copyAffiliateLink = () => {
    if (!affiliate) return;
    
    // ✅ Utiliser le slug personnalisé si disponible, sinon l'ID
    const ref = affiliate.slug || affiliate.id;
    const link = `${window.location.origin}?ref=${ref}`;
    navigator.clipboard.writeText(link);
    toast.success('Lien copié !');
  };

  const requestPayout = async () => {
    setRequestingPayout(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-affiliate-payout');

      if (error || !data?.success) {
        console.error('[Affiliate] Payout request error:', error || data?.error);
        toast.error(data?.error || "Erreur lors de la demande de paiement");
        return;
      }

      toast.success(
        `Ta demande de paiement de ${data.amount}€ a bien été envoyée. Alfie s'occupe du reste 🐶✨`
      );

      // Rafraîchir les données
      await loadAffiliateData();
    } catch (err: any) {
      console.error('[Affiliate] Unexpected error:', err);
      toast.error("Erreur inattendue lors de la demande de paiement");
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleStripeConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard');
      if (error || !data?.url) {
        toast.error("Erreur lors de la connexion à Stripe");
        return;
      }
      window.location.href = data.url;
    } catch (err: any) {
      console.error('[Stripe Connect] Error:', err);
      toast.error("Erreur lors de la connexion à Stripe");
    } finally {
      setConnecting(false);
    }
  };

  const handleStripeRefresh = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-refresh');
      if (error || !data?.url) {
        toast.error("Erreur lors de la génération du lien");
        return;
      }
      window.location.href = data.url;
    } catch (err: any) {
      console.error('[Stripe Refresh] Error:', err);
      toast.error("Erreur lors de la génération du lien");
    }
  };

  const handleStripeDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-dashboard');
      if (error || !data?.url) {
        toast.error("Erreur lors de l'accès au dashboard");
        return;
      }
      window.open(data.url, '_blank');
    } catch (err: any) {
      console.error('[Stripe Dashboard] Error:', err);
      toast.error("Erreur lors de l'accès au dashboard");
    }
  };

  const handleStripeDisconnect = async () => {
    const confirmDisconnect = window.confirm(
      "Êtes-vous sûr de vouloir déconnecter votre compte Stripe ? Vous devrez le reconnecter pour recevoir vos paiements."
    );
    
    if (!confirmDisconnect) return;

    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-disconnect');
      if (error || !data?.success) {
        toast.error("Erreur lors de la déconnexion");
        return;
      }
      toast.success("Compte Stripe déconnecté avec succès");
      await loadAffiliateData();
    } catch (err: any) {
      console.error('[Stripe Disconnect] Error:', err);
      toast.error("Erreur lors de la déconnexion");
    }
  };

  const handleUpdateSlug = async () => {
    if (!editingSlug || !affiliate) return;
    
    setUpdatingSlug(true);
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ slug: editingSlug })
        .eq('id', affiliate.id);

      if (error) {
        console.error('[Affiliate] Slug update error:', error);
        if (error.message.includes('duplicate') || error.code === '23505') {
          toast.error(
            'Ce nom de lien n\'est pas disponible',
            { 
              description: 'Quelqu\'un d\'autre utilise déjà ce lien. Essaie avec un autre nom ! 🐶',
              duration: 5000
            }
          );
        } else {
          toast.error('Erreur lors de la mise à jour du slug');
        }
        return;
      }

      toast.success('Lien personnalisé mis à jour ! 🎉');
      
      // Refresh affiliate data
      await loadAffiliateData();
    } catch (err: any) {
      console.error('[Affiliate] Unexpected error:', err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdatingSlug(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Programme MLM Alfie Designer</h1>
        <p className="text-muted-foreground mb-6">
          Votre compte affilié a été créé automatiquement ! Partagez votre lien et gagnez jusqu'à 3 niveaux de commissions.
        </p>
        <Button onClick={loadAffiliateData} className="gradient-hero text-white">
          Actualiser
        </Button>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'leader':
        return { label: 'Leader', icon: Crown, color: 'bg-gradient-to-r from-yellow-500 to-orange-500', textColor: 'text-yellow-600' };
      case 'mentor':
        return { label: 'Mentor', icon: Award, color: 'bg-gradient-to-r from-blue-500 to-purple-500', textColor: 'text-blue-600' };
      default:
        return { label: 'Créateur', icon: Target, color: 'bg-gradient-to-r from-green-500 to-teal-500', textColor: 'text-green-600' };
    }
  };

  const statusInfo = getStatusInfo(affiliate.affiliate_status);
  const StatusIcon = statusInfo.icon;

  const getNextStatusProgress = () => {
    const activeReferrals = affiliate.active_direct_referrals || 0;
    if (affiliate.affiliate_status === 'creator') {
      return { current: activeReferrals, target: 3, next: 'Mentor' };
    } else if (affiliate.affiliate_status === 'mentor') {
      return { current: activeReferrals, target: 5, next: 'Leader' };
    }
    return null;
  };

  const nextStatus = getNextStatusProgress();

  // Calculer les gains non payés
  const MIN_PAYOUT = 50;
  const paidPayouts = payouts
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const unpaidEarnings = stats.totalEarnings - paidPayouts;
  const hasPendingPayout = payouts.some(p => p.status === 'pending');
  
  // Vérifier si l'utilisateur a un abonnement actif
  const hasActiveSubscription = profile?.plan && profile?.plan !== 'none' && profile?.stripe_subscription_id;
  
  const canRequestPayout = unpaidEarnings >= MIN_PAYOUT && !hasPendingPayout && hasActiveSubscription;

  // Generate affiliate link using slug if available, otherwise fallback to ID
  const affiliateLink = affiliate?.slug 
    ? `${window.location.origin}?ref=${affiliate.slug}`
    : `${window.location.origin}?ref=${affiliate?.id}`;

  return (
    <div className="space-y-6">
      {/* Header with Status Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Programme MLM Alfie Designer</h1>
          <p className="text-muted-foreground">
            Bienvenue {affiliate.name} ! Suivez vos performances multi-niveaux.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Badge Ambassadeur - Pour TOUS les affiliés */}
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 text-base font-semibold shadow-lg">
            🎖️ Ambassadeur
          </Badge>
          
          {/* Badge Statut gamification (Créateur/Mentor/Leader) */}
          <div className={`${statusInfo.color} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2`}>
            <StatusIcon className="h-6 w-6" />
            <span className="font-bold text-lg">{statusInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Status Progress Card */}
      {nextStatus && (
        <Card className="border-primary/20 shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Progression vers {nextStatus.next}
            </CardTitle>
            <CardDescription>
              {nextStatus.current} / {nextStatus.target} filleuls actifs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={(nextStatus.current / nextStatus.target) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">
              Plus que {nextStatus.target - nextStatus.current} filleul(s) pour débloquer le statut {nextStatus.next} !
            </p>
          </CardContent>
        </Card>
      )}

      {/* Carte Stripe Connect */}
      <Card className="border-primary/20 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Compte de paiement
          </CardTitle>
          <CardDescription>
            Configure ton compte Stripe pour recevoir tes paiements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!affiliate?.stripe_connect_account_id ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Connecte ton compte Stripe pour recevoir tes paiements
              </p>
              <Button onClick={handleStripeConnect} disabled={connecting} className="gradient-hero text-white">
                {connecting ? 'Connexion...' : 'Connecter mon compte Stripe'}
              </Button>
            </div>
          ) : !affiliate?.stripe_connect_onboarding_complete ? (
            <div className="text-center py-4">
              <Badge className="bg-yellow-500 mb-3">Onboarding en cours</Badge>
              <p className="text-muted-foreground mb-4">
                Complete la configuration de ton compte Stripe
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={handleStripeRefresh} variant="outline">
                  Reprendre la configuration
                </Button>
                <Button onClick={handleStripeDisconnect} variant="ghost" size="sm" className="text-destructive">
                  Changer de compte
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Problème d'accès ? Tu peux déconnecter et reconnecter un autre compte.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Badge className="bg-green-500 mb-3">✓ Compte configuré</Badge>
              <p className="text-muted-foreground mb-4">
                Ton compte Stripe est prêt à recevoir des paiements
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleStripeDashboard} variant="outline" size="sm">
                  Accéder à mon dashboard Stripe
                </Button>
                <Button onClick={handleStripeDisconnect} variant="destructive" size="sm">
                  Déconnecter
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affiliate Link */}
      <Card className="border-primary/30 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Votre lien d'affiliation personnalisé
          </CardTitle>
          <CardDescription>
            Partagez ce lien pour construire votre réseau MLM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Slug Editor */}
          <div className="space-y-2">
            <Label htmlFor="slug">Personnaliser votre lien</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/30">
                <span className="text-sm text-muted-foreground">{window.location.origin}?ref=</span>
                <Input
                  id="slug"
                  value={editingSlug}
                  onChange={(e) => setEditingSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateSlug();
                    }
                  }}
                  placeholder="votre-nom"
                  className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 flex-1"
                />
              </div>
              <Button 
                onClick={handleUpdateSlug} 
                disabled={updatingSlug || !editingSlug || editingSlug === affiliate.slug}
                className="gap-2"
              >
                {updatingSlug ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisez uniquement des lettres minuscules, chiffres et tirets
            </p>
          </div>

          {/* Current Link Display */}
          <div className="flex gap-2">
            <Input
              readOnly
              value={affiliateLink}
              className="font-mono text-sm border-primary/30"
            />
            <Button onClick={copyAffiliateLink} className="gap-2 gradient-hero text-white">
              <Copy className="h-4 w-4" />
              Copier
            </Button>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Structure des commissions :</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• <strong className="text-green-600">Niveau 1:</strong> 15% sur vos filleuls directs (minimum 29€/mois)</li>
              <li>• <strong className="text-blue-600">Niveau 2:</strong> 5% sur le réseau niveau 2 (≥3 filleuls actifs)</li>
              <li>• <strong className="text-purple-600">Niveau 3:</strong> 2% sur le réseau niveau 3 (≥5 filleuls actifs)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-4 gap-4">
        <Card 
          className="border-blue-500/20 shadow-soft hover:shadow-medium transition-shadow cursor-pointer"
          onClick={() => setShowClicksBreakdown(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clics</CardTitle>
            <MousePointerClick className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.totalClicks}</div>
            <p className="text-xs text-muted-foreground mt-1">Cliquez pour voir les sources</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 shadow-soft hover:shadow-medium transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.totalConversions}</div>
            {stats.totalClicks > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)}% taux
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 shadow-soft hover:shadow-medium transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gains totaux</CardTitle>
            <DollarSign className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.totalEarnings.toFixed(2)}€</div>
            
            {/* Gains non payés */}
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Disponible : </span>
              <span className="font-semibold text-green-600">
                {unpaidEarnings.toFixed(2)}€
              </span>
            </div>
            
            {/* Bouton demande paiement */}
            <Button
              onClick={requestPayout}
              disabled={!canRequestPayout || requestingPayout}
              className="mt-4 w-full gradient-hero text-white"
              size="sm"
            >
              {requestingPayout ? 'Demande en cours…' : 'Demander un paiement'}
            </Button>

            {/* Message si gains insuffisants */}
            {unpaidEarnings < MIN_PAYOUT && !hasPendingPayout && hasActiveSubscription && (
              <p className="mt-2 text-xs text-muted-foreground">
                Minimum {MIN_PAYOUT}€ requis pour demander un paiement
              </p>
            )}

            {/* Message si demande en cours */}
            {hasPendingPayout && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-orange-600">
                  Une demande est déjà en cours de traitement
                </p>
                <p className="text-xs text-muted-foreground">
                  📅 Les paiements sont traités le 15 du mois suivant
                </p>
              </div>
            )}
            
            {/* Message sur la date de paiement si pas de demande en cours */}
            {!hasPendingPayout && canRequestPayout && (
              <p className="mt-2 text-xs text-muted-foreground">
                📅 Les demandes effectuées avant fin du mois sont payées le 15 du mois suivant
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 shadow-soft hover:shadow-medium transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payout en attente</CardTitle>
            <DollarSign className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.pendingPayout.toFixed(2)}€</div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Breakdown by Level */}
      <Card className="gradient-subtle border-0 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Répartition des commissions par niveau
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-card rounded-lg p-4 border-2 border-green-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Niveau 1 (15%)</span>
                <Badge className="bg-green-500">Direct</Badge>
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.level1Earnings.toFixed(2)}€</div>
              <p className="text-xs text-muted-foreground mt-1">Filleuls directs</p>
            </div>

            <div className="bg-card rounded-lg p-4 border-2 border-blue-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Niveau 2 (5%)</span>
                <Badge className="bg-blue-500">Indirect</Badge>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.level2Earnings.toFixed(2)}€</div>
              <p className="text-xs text-muted-foreground mt-1">Réseau de niveau 2</p>
            </div>

            <div className="bg-card rounded-lg p-4 border-2 border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Niveau 3 (2%)</span>
                <Badge className="bg-purple-500">Réseau</Badge>
              </div>
              <div className="text-2xl font-bold text-purple-600">{stats.level3Earnings.toFixed(2)}€</div>
              <p className="text-xs text-muted-foreground mt-1">Réseau de niveau 3</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mes Conversions (Nouveaux abonnés, Upgrades, Packs Woofs) */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Mes conversions ({conversions.length})
          </CardTitle>
          <CardDescription>Abonnements, upgrades et packs Woofs générés</CardDescription>
        </CardHeader>
        <CardContent>
          {conversions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune conversion pour le moment. Partagez votre lien pour commencer !
            </p>
          ) : (
            <div className="space-y-3">
              {conversions.slice(0, 15).map((conversion) => {
                const plan = conversion.plan || '';
                let badge = { label: plan, icon: UserPlus2, color: 'bg-green-500', textColor: 'text-green-600' };
                
                if (plan.startsWith('woofs_pack:')) {
                  const size = plan.split(':')[1];
                  badge = { label: `Pack ${size} Woofs`, icon: Package, color: 'bg-orange-500', textColor: 'text-orange-600' };
                } else if (plan.startsWith('upgrade:')) {
                  const tier = plan.split(':')[1];
                  badge = { label: `Upgrade ${tier}`, icon: ArrowUp, color: 'bg-blue-500', textColor: 'text-blue-600' };
                } else if (plan.startsWith('subscription:')) {
                  const tier = plan.split(':')[1];
                  badge = { label: `Nouvel abonné ${tier}`, icon: UserPlus2, color: 'bg-green-500', textColor: 'text-green-600' };
                }

                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={conversion.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${badge.color} flex items-center justify-center text-white`}>
                        <BadgeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <Badge className={badge.color}>{badge.label}</Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(conversion.created_at).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-lg ${badge.textColor}`}>
                        {Number(conversion.amount || 0).toFixed(2)}€
                      </span>
                      <p className="text-xs text-muted-foreground">Transaction</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct Referrals */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Mes filleuls directs ({directReferrals.length})
          </CardTitle>
          <CardDescription>Votre équipe de niveau 1</CardDescription>
        </CardHeader>
        <CardContent>
          {directReferrals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun filleul pour le moment. Partagez votre lien pour commencer !
            </p>
          ) : (
            <div className="space-y-3">
              {directReferrals.map((referral) => {
                const refStatus = getStatusInfo(referral.affiliate_status);
                const RefIcon = refStatus.icon;
                return (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${refStatus.color} flex items-center justify-center text-white`}>
                        <RefIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{referral.name}</p>
                        <p className="text-sm text-muted-foreground">{maskEmail(referral.email)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={refStatus.color}>{refStatus.label}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {referral.active_direct_referrals || 0} filleul(s)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Commissions */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle>Commissions détaillées récentes</CardTitle>
          <CardDescription>Historique de vos gains par niveau</CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune commission pour le moment
            </p>
          ) : (
            <div className="space-y-2">
              {commissions.slice(0, 10).map((commission) => {
                const levelStyles = 
                  commission.level === 1 
                    ? { border: 'border-green-500/20', bg: 'bg-green-50/10', badge: 'bg-green-500', text: 'text-green-600' }
                    : commission.level === 2 
                    ? { border: 'border-blue-500/20', bg: 'bg-blue-50/10', badge: 'bg-blue-500', text: 'text-blue-600' }
                    : { border: 'border-purple-500/20', bg: 'bg-purple-50/10', badge: 'bg-purple-500', text: 'text-purple-600' };
                
                return (
                  <div
                    key={commission.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${levelStyles.border} ${levelStyles.bg}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={levelStyles.badge}>Niveau {commission.level}</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({(commission.commission_rate * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(commission.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-bold text-lg ${levelStyles.text}`}>
                      +{Number(commission.amount).toFixed(2)}€
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payouts History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements</CardTitle>
          <CardDescription>Vos payouts</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Aucun payout pour le moment
            </p>
          ) : (
            <div className="space-y-2">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">Payout {payout.period}</p>
                    <p className="text-sm text-muted-foreground">
                      {payout.paid_at
                        ? `Payé le ${new Date(payout.paid_at).toLocaleDateString()}`
                        : 'En attente'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>
                      {payout.status}
                    </Badge>
                    <span className="font-bold">{payout.amount}€</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Répartition des clics par source */}
      <Dialog open={showClicksBreakdown} onOpenChange={setShowClicksBreakdown}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Répartition des clics par source
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {clicksBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucun clic enregistré</p>
            ) : (
              clicksBreakdown.map(({ source, count }) => {
                const percentage = stats.totalClicks > 0 
                  ? (count / stats.totalClicks * 100).toFixed(1) 
                  : '0';
                
                const getSourceIcon = (src: string) => {
                  switch (src.toLowerCase()) {
                    case 'facebook': return <Facebook className="h-5 w-5 text-blue-600" />;
                    case 'instagram': return <Instagram className="h-5 w-5 text-pink-500" />;
                    case 'linkedin': return <Linkedin className="h-5 w-5 text-blue-700" />;
                    case 'tiktok': return <span className="text-lg">🎵</span>;
                    case 'twitter': case 'x': return <span className="text-lg">𝕏</span>;
                    case 'email': return <span className="text-lg">📧</span>;
                    case 'youtube': return <span className="text-lg">▶️</span>;
                    default: return <MousePointerClick className="h-5 w-5 text-gray-500" />;
                  }
                };
                
                return (
                  <div key={source} className="flex items-center gap-3">
                    {getSourceIcon(source)}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium capitalize">{source}</span>
                        <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                      </div>
                      <Progress value={parseFloat(percentage)} className="h-2" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Instructions UTM */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              💡 Pour tracker les sources, ajoute <code className="bg-background px-1 rounded">utm_source</code> à ton lien :
            </p>
            <code className="text-xs block mt-2 bg-background p-2 rounded break-all">
              {affiliateLink}&utm_source=facebook
            </code>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
