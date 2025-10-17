import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Copy, DollarSign, MousePointerClick, TrendingUp, Users, Award, Target, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

export default function Affiliate() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [directReferrals, setDirectReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalClicks: 0,
    totalConversions: 0,
    totalEarnings: 0,
    pendingPayout: 0,
    level1Earnings: 0,
    level2Earnings: 0,
    level3Earnings: 0
  });

  useEffect(() => {
    loadAffiliateData();
  }, [user]);

  const loadAffiliateData = async () => {
    if (!user) return;

    try {
      // Get affiliate info
      const { data: affiliateData } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!affiliateData) {
        setLoading(false);
        return;
      }

      setAffiliate(affiliateData);

      // Get clicks
      const { data: clicksData } = await supabase
        .from('affiliate_clicks')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Get conversions
      const { data: conversionsData } = await supabase
        .from('affiliate_conversions')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false });

      // Get payouts
      const { data: payoutsData } = await supabase
        .from('affiliate_payouts')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false });

      // Get commissions by level
      const { data: commissionsData } = await supabase
        .from('affiliate_commissions')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false });

      // Get direct referrals
      const { data: referralsData } = await supabase
        .from('affiliates')
        .select('id, name, email, created_at, affiliate_status, active_direct_referrals')
        .eq('parent_id', affiliateData.id);

      setPayouts(payoutsData || []);
      setCommissions(commissionsData || []);
      setDirectReferrals(referralsData || []);

      // Calculate stats by commission level
      const level1Earnings = (commissionsData || [])
        .filter((c: any) => c.level === 1)
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const level2Earnings = (commissionsData || [])
        .filter((c: any) => c.level === 2)
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const level3Earnings = (commissionsData || [])
        .filter((c: any) => c.level === 3)
        .reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      
      const totalEarnings = level1Earnings + level2Earnings + level3Earnings;
      const pendingPayout = (payoutsData || [])
        .filter((p: any) => p.status === 'pending')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      setStats({
        totalClicks: clicksData?.length || 0,
        totalConversions: conversionsData?.length || 0,
        totalEarnings,
        pendingPayout,
        level1Earnings,
        level2Earnings,
        level3Earnings
      });
    } catch (error) {
      console.error('Error loading affiliate data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const copyAffiliateLink = () => {
    if (!affiliate) return;
    
    const link = `${window.location.origin}?ref=${affiliate.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Lien copié !');
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
        <div className={`${statusInfo.color} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2`}>
          <StatusIcon className="h-6 w-6" />
          <span className="font-bold text-lg">{statusInfo.label}</span>
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

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-blue-500/20 shadow-soft hover:shadow-medium transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clics</CardTitle>
            <MousePointerClick className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.totalClicks}</div>
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

      {/* Affiliate Link */}
      <Card className="border-primary/30 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Votre lien d'affiliation
          </CardTitle>
          <CardDescription>
            Partagez ce lien pour construire votre réseau MLM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              readOnly
              value={`${window.location.origin}?ref=${affiliate.id}`}
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
                        <p className="text-sm text-muted-foreground">{referral.email}</p>
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
    </div>
  );
}
