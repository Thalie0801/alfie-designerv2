import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Copy,
  DollarSign,
  MousePointerClick,
  TrendingUp,
  Users,
  Award,
  Target,
  Crown,
  Share2,
  Edit3,
  CalendarClock,
  HelpCircle,
  ArrowUpRight,
  Globe,
  MonitorSmartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { eachDayOfInterval, format, isSameDay, subDays } from 'date-fns';

const KPI_TOOLTIPS = {
  clicks: 'Clics uniques suivis via cookie 1er parti (fenêtre 30 jours).',
  conversions: 'Conversions uniques validées : abonnés payants sans remboursement.',
  earnings: 'Somme des commissions validées (hors remboursements).',
  payout: 'Montant disponible pour payout : gains validés – paiements versés – retenues.'
} satisfies Record<'clicks' | 'conversions' | 'earnings' | 'payout', string>;

const RATE_BY_LEVEL: Record<number, number> = {
  1: 15,
  2: 5,
  3: 2
};

const chartConfig = {
  clicks: {
    label: 'Clics',
    color: '#2563eb'
  },
  conversions: {
    label: 'Conversions',
    color: '#16a34a'
  }
} as const;

type AffiliateStats = {
  uniqueClicks: number;
  uniqueConversions: number;
  totalEarnings: number;
  payoutAvailable: number;
  conversionRate: number;
  activeRefs: number;
  neededForMentor: number;
};

type ActivityItem = {
  id: string;
  type: 'click' | 'conversion';
  timestamp: string;
  country?: string | null;
  device?: string | null;
};

const SUCCESS_MESSAGES: Record<string, string> = {
  mentor: 'Bravo — Mentor débloqué !',
  leader: 'Exceptionnel — Ambassadeur confirmé !'
};

const sanitizeSuffix = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const sanitized = trimmed
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized;
};

export default function Affiliate() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [clicks, setClicks] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [directReferrals, setDirectReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState<AffiliateStats>({
    uniqueClicks: 0,
    uniqueConversions: 0,
    totalEarnings: 0,
    payoutAvailable: 0,
    conversionRate: 0,
    activeRefs: 0,
    neededForMentor: 3
  });
  const [chartRange, setChartRange] = useState<'7' | '30'>('7');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [suffixDialogOpen, setSuffixDialogOpen] = useState(false);
  const [customSuffix, setCustomSuffix] = useState('');
  const [suffixDraft, setSuffixDraft] = useState('');
  const [savingSuffix, setSavingSuffix] = useState(false);

  useEffect(() => {
    loadAffiliateData();
  }, [user]);

  const loadAffiliateData = async () => {
    if (!user?.email) {
      setAffiliate(null);
      setLoading(false);
      return;
    }

    try {
      const { data: affiliateData, error: affiliateError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (affiliateError) {
        throw affiliateError;
      }

      if (!affiliateData) {
        return;
      }

      setAffiliate(affiliateData);
      setCustomSuffix(affiliateData.code || affiliateData.custom_suffix || affiliateData.id);

      const { data: clicksData } = await supabase
        .from('affiliate_clicks')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: conversionsData } = await supabase
        .from('affiliate_conversions')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false });

      const { data: payoutsData } = await supabase
        .from('affiliate_payouts')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false });

      const { data: commissionsData } = await supabase
        .from('affiliate_commissions')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false });

      const { data: referralsData } = await supabase
        .from('affiliates')
        .select('id, name, email, created_at, affiliate_status, active_direct_referrals')
        .eq('parent_id', affiliateData.id);

      setClicks(clicksData || []);
      setConversions(conversionsData || []);
      setPayouts(payoutsData || []);
      setCommissions(commissionsData || []);
      setDirectReferrals(referralsData || []);

      const uniqueClickSessions = new Set(
        (clicksData || []).map((click: any) => click.session_id || click.id)
      );
      const uniqueConversionCustomers = new Set(
        (conversionsData || []).map((conversion: any) => conversion.customer_id || conversion.id)
      );

      const validatedCommissions = (commissionsData || []).filter((commission: any) =>
        ['validated', 'paid', 'completed', 'complete'].includes(commission.status)
      );

      const totalValidated = validatedCommissions.reduce(
        (sum: number, commission: any) => sum + Number(commission.amount || 0),
        0
      );

      const paidOut = (payoutsData || [])
        .filter((payout: any) => payout.status === 'paid')
        .reduce((sum: number, payout: any) => sum + Number(payout.amount || 0), 0);

      const retainedAmount = Number(
        affiliateData.retained_amount ??
          affiliateData.payout_retention ??
          affiliateData.hold_amount ??
          0
      );

      const payoutAvailable = Math.max(0, totalValidated - paidOut - retainedAmount);
      const activeRefs = Number(affiliateData.active_direct_referrals || 0);
      const neededForMentor = Math.max(0, 3 - activeRefs);
      const conversionRate = uniqueClickSessions.size
        ? (uniqueConversionCustomers.size / uniqueClickSessions.size) * 100
        : 0;

      setStats({
        uniqueClicks: uniqueClickSessions.size,
        uniqueConversions: uniqueConversionCustomers.size,
        totalEarnings: totalValidated,
        payoutAvailable,
        conversionRate,
        activeRefs,
        neededForMentor
      });
    } catch (error) {
      console.error('Error loading affiliate data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (suffixDialogOpen) {
      setSuffixDraft(customSuffix);
    }
  }, [suffixDialogOpen, customSuffix]);

  const copyAffiliateLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Lien copié !');
  };

  const shareAffiliateLink = async (link: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Programme affilié Alfie Designer',
          text: "Rejoins Alfie Designer avec mon lien d'affiliation",
          url: link
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Partage annulé ou indisponible');
        }
      }
    } else {
      toast.info('Partage natif non supporté sur ce navigateur.');
    }
  };

  const handleSaveSuffix = async () => {
    if (!affiliate) return;

    const sanitized = sanitizeSuffix(suffixDraft);

    if (!sanitized) {
      toast.error('Choisissez un suffixe avec des lettres, chiffres ou tirets.');
      return;
    }

    setSavingSuffix(true);
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ code: sanitized })
        .eq('id', affiliate.id);

      if (error) {
        throw error;
      }

      setAffiliate({ ...affiliate, code: sanitized });
      setCustomSuffix(sanitized);
      toast.success('Suffixe mis à jour !');
      setSuffixDialogOpen(false);
    } catch (error) {
      console.error('Error updating suffix:', error);
      toast.error('Impossible de sauvegarder le suffixe');
    } finally {
      setSavingSuffix(false);
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
        return {
          label: 'Ambassadeur',
          icon: Crown,
          color: 'bg-gradient-to-r from-yellow-500 to-orange-500',
          textColor: 'text-yellow-600'
        };
      case 'mentor':
        return {
          label: 'Mentor',
          icon: Award,
          color: 'bg-gradient-to-r from-blue-500 to-purple-500',
          textColor: 'text-blue-600'
        };
      default:
        return {
          label: 'Créateur',
          icon: Target,
          color: 'bg-gradient-to-r from-green-500 to-teal-500',
          textColor: 'text-green-600'
        };
    }
  };

  const statusInfo = getStatusInfo(affiliate.affiliate_status);
  const StatusIcon = statusInfo.icon;

  const nextStatus = {
    current: stats.activeRefs,
    target: 3,
    next: 'Mentor'
  };

  const mentorDeadlineRaw = affiliate.mentor_deadline || affiliate.challenge_deadline;
  const mentorDeadlineDate = mentorDeadlineRaw ? new Date(mentorDeadlineRaw) : null;
  const hasMentorDeadline = mentorDeadlineDate && !Number.isNaN(mentorDeadlineDate.getTime());

  const affiliateCode = customSuffix || affiliate.code || affiliate.id;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.alfie.ai';
  const baseLink = `${origin}?ref=${affiliateCode}`;
  const utmParams = `utm_source=affiliate&utm_campaign=mlm&aff=${affiliateCode}`;
  const affiliateLink = `${baseLink}&${utmParams}`;
  const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    affiliateLink
  )}`;

  const canViewFinancials = affiliate.user_id
    ? affiliate.user_id === user?.id
    : affiliate.id === user?.id;

  const formatAmount = (value: number) => `${value.toFixed(2)}€`;
  const displayAmount = (value: number) => (canViewFinancials ? formatAmount(value) : '•••');

  const levelSummaries = useMemo(() => {
    return [1, 2, 3].map((level) => {
      const earnings = (commissions || [])
        .filter((commission) => Number(commission.level) === level)
        .filter((commission) => ['validated', 'paid', 'completed', 'complete'].includes(commission.status))
        .reduce((sum: number, commission: any) => sum + Number(commission.amount || 0), 0);

      const activeCount = (conversions || [])
        .filter((conversion) => Number(conversion.level) === level)
        .filter((conversion) => ['active', 'validated', 'paid'].includes(conversion.status))
        .reduce((sum: number) => sum + 1, 0);

      return {
        level,
        earnings,
        activeCount,
        rate: RATE_BY_LEVEL[level] || 0
      };
    });
  }, [commissions, conversions]);

  const chartData = useMemo(() => {
    const range = chartRange === '7' ? 7 : 30;
    const end = new Date();
    const start = subDays(end, range - 1);
    const days = eachDayOfInterval({ start, end });

    return days.map((day) => {
      const dayClicks = (clicks || []).filter((click) =>
        click.created_at ? isSameDay(new Date(click.created_at), day) : false
      );
      const dayConversions = (conversions || []).filter((conversion) =>
        conversion.created_at ? isSameDay(new Date(conversion.created_at), day) : false
      );

      return {
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, 'dd MMM'),
        clicks: dayClicks.length,
        conversions: dayConversions.length
      };
    });
  }, [chartRange, clicks, conversions]);

  const activityItems: ActivityItem[] = useMemo(() => {
    const clickItems = (clicks || []).map((click) => ({
      id: `click-${click.id}`,
      type: 'click' as const,
      timestamp: click.created_at,
      country: click.country || click.geo_country || click.location,
      device: click.device || click.user_agent || click.platform
    }));

    const conversionItems = (conversions || []).map((conversion) => ({
      id: `conversion-${conversion.id}`,
      type: 'conversion' as const,
      timestamp: conversion.created_at,
      country: conversion.country || conversion.customer_country,
      device: conversion.device || conversion.source
    }));

    return [...clickItems, ...conversionItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [clicks, conversions]);

  const zeroClicks = stats.uniqueClicks === 0;

  const successMessage = SUCCESS_MESSAGES[affiliate.affiliate_status];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Programme MLM Alfie Designer</h1>
          <p className="text-muted-foreground">
            Bienvenue {affiliate.name} ! Suivez vos performances multi-niveaux.
          </p>
        </div>
        <div className={cn(statusInfo.color, 'text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2')}>
          <StatusIcon className="h-6 w-6" />
          <span className="font-bold text-lg">{statusInfo.label}</span>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
          <ArrowUpRight className="h-5 w-5" />
          <div>
            <p className="font-semibold">{successMessage}</p>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-200/80">
              Continuez à accompagner vos filleuls pour consolider votre statut.
            </p>
          </div>
        </div>
      )}

      <Card className="border-primary/20 shadow-medium">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Progression vers Mentor
            </CardTitle>
            <CardDescription>
              {nextStatus.current} / {nextStatus.target} filleuls actifs
              {hasMentorDeadline && mentorDeadlineDate && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <CalendarClock className="h-3 w-3" />
                  Challenge jusqu'au {format(mentorDeadlineDate, 'dd MMM yyyy')}
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={() => setShareDialogOpen(true)} className="gap-2">
            <Share2 className="h-4 w-4" />
            Inviter
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={(nextStatus.current / nextStatus.target) * 100} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {stats.neededForMentor > 0
              ? `Encore ${stats.neededForMentor} filleul(s) actif(s) pour débloquer le statut Mentor.`
              : 'Objectif Mentor atteint — continuez pour viser Ambassadeur !'}
          </p>
        </CardContent>
      </Card>

      {zeroClicks && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="py-6">
            <div className="flex flex-col items-center text-center gap-3">
              <MousePointerClick className="h-10 w-10 text-primary" />
              <h3 className="text-lg font-semibold">Partage ton lien pour démarrer</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Aucun clic détecté pour l'instant. Active ton réseau en partageant le lien d'affiliation et en guidant tes prospects.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Publie ton lien sur tes réseaux sociaux clés</li>
                <li>• Envoie un message personnalisé à tes contacts stratégiques</li>
                <li>• Ajoute-le dans ta bio ou signature d'email</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-blue-500/20 shadow-soft hover:shadow-medium transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total clics</CardTitle>
                  <MousePointerClick className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{stats.uniqueClicks}</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{KPI_TOOLTIPS.clicks}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-green-500/20 shadow-soft hover:shadow-medium transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats.uniqueConversions}</div>
                  {stats.uniqueClicks > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.conversionRate.toFixed(1)}% taux
                    </p>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{KPI_TOOLTIPS.conversions}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-purple-500/20 shadow-soft hover:shadow-medium transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Gains totaux</CardTitle>
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{displayAmount(stats.totalEarnings)}</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{KPI_TOOLTIPS.earnings}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-orange-500/20 shadow-soft hover:shadow-medium transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Payout disponible</CardTitle>
                  <DollarSign className="h-5 w-5 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{displayAmount(stats.payoutAvailable)}</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{KPI_TOOLTIPS.payout}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <Card className="shadow-medium">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Engagement (7j / 30j)
            </CardTitle>
            <CardDescription>Visualisez vos clics et conversions sur la période choisie.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={chartRange === '7' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartRange('7')}
            >
              7 jours
            </Button>
            <Button
              variant={chartRange === '30' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartRange('30')}
            >
              30 jours
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[260px]">
            <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="4 4" className="stroke-muted" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="clicks" stroke="var(--color-clicks)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="conversions" stroke="var(--color-conversions)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="gradient-subtle border-0 shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Répartition des commissions par niveau
          </CardTitle>
          <CardDescription>Suivez vos gains et filleuls actifs sur 3 niveaux.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {levelSummaries.map((summary) => (
              <div
                key={summary.level}
                className={cn(
                  'rounded-lg p-4 border-2',
                  summary.level === 1 && 'border-green-500/30',
                  summary.level === 2 && 'border-blue-500/30',
                  summary.level === 3 && 'border-purple-500/30'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Niveau {summary.level} ({summary.rate}%)
                  </span>
                  <Badge
                    className={cn(
                      summary.level === 1 && 'bg-green-500',
                      summary.level === 2 && 'bg-blue-500',
                      summary.level === 3 && 'bg-purple-500'
                    )}
                  >
                    {summary.level === 1 ? 'Direct' : summary.level === 2 ? 'Indirect' : 'Réseau'}
                  </Badge>
                </div>
                <div className="text-2xl font-bold">
                  {displayAmount(summary.earnings)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.activeCount} filleul(s) actif(s) niveau {summary.level}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-dashed border-primary/30 p-4 bg-primary/5">
            <p className="text-sm font-medium mb-2">Prochaine étape</p>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <Progress value={(nextStatus.current / nextStatus.target) * 100} className="h-2 md:flex-1" />
              <span className="text-sm font-semibold text-primary">
                {stats.neededForMentor > 0
                  ? `+${stats.neededForMentor} actifs → Mentor`
                  : 'Mentor acquis — cap sur Ambassadeur !'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 shadow-medium">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              Lien d'affiliation
            </CardTitle>
            <CardDescription>Partagez ce lien pour construire votre réseau MLM.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => copyAffiliateLink(affiliateLink)} className="gap-2">
              <Copy className="h-4 w-4" />
              Copier
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => shareAffiliateLink(affiliateLink)}
            >
              <Share2 className="h-4 w-4" />
              Partager
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setSuffixDialogOpen(true)}>
              <Edit3 className="h-4 w-4" />
              Personnaliser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Lien complet</Label>
            <Input readOnly value={affiliateLink} className="font-mono text-sm border-primary/30" />
          </div>
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 bg-muted/40 text-sm">
            <p className="font-medium mb-2">Paramètres UTM visibles :</p>
            <div className="grid gap-1 font-mono text-xs">
              <span>utm_source=affiliate</span>
              <span>utm_campaign=mlm</span>
              <span>aff={affiliateCode}</span>
            </div>
          </div>
          <details className="rounded-lg border border-muted-foreground/20 p-4 bg-muted/30 text-sm">
            <summary className="flex items-center gap-2 cursor-pointer font-medium">
              <HelpCircle className="h-4 w-4" />
              Comment ça marche ?
            </summary>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>• Tracking 1er clic : cookie propriétaire valable 365 jours.</p>
              <p>• Attribution : première conversion payante non remboursée = filleul actif.</p>
              <p>• Taux de conversion = conversions uniques / clics uniques (fenêtre 30 jours).</p>
              <p>• Paiements : gains validés après retenue et paiements précédents.</p>
            </div>
          </details>
        </CardContent>
      </Card>

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
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white', refStatus.color)}>
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

      {activityItems.length > 0 && (
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>Derniers clics et conversions (date, pays, device)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityItems.map((item) => {
                  const date = item.timestamp ? new Date(item.timestamp) : null;
                  const formattedDate =
                    date && !Number.isNaN(date.getTime())
                      ? format(date, 'dd MMM yyyy HH:mm')
                      : '—';

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant={item.type === 'conversion' ? 'default' : 'secondary'}>
                          {item.type === 'conversion' ? 'Conversion' : 'Clic'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formattedDate}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>{item.country || '—'}</span>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                        <span>{item.device || '—'}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                const level = Number(commission.level);
                const levelStyles =
                  level === 1
                    ? {
                        border: 'border-green-500/20',
                        bg: 'bg-green-50/10',
                        badge: 'bg-green-500',
                        text: 'text-green-600'
                      }
                    : level === 2
                    ? {
                        border: 'border-blue-500/20',
                        bg: 'bg-blue-50/10',
                        badge: 'bg-blue-500',
                        text: 'text-blue-600'
                      }
                    : {
                        border: 'border-purple-500/20',
                        bg: 'bg-purple-50/10',
                        badge: 'bg-purple-500',
                        text: 'text-purple-600'
                      };
                const ratePercent =
                  commission.rate_bp !== undefined && commission.rate_bp !== null
                    ? Number(commission.rate_bp) / 100
                    : Number(commission.commission_rate || 0) * 100;

                return (
                  <div
                    key={commission.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border',
                      levelStyles.border,
                      levelStyles.bg
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={levelStyles.badge}>Niveau {level}</Badge>
                        <span className="text-sm text-muted-foreground">
                          ({ratePercent.toFixed(0)}%)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {commission.created_at
                          ? format(new Date(commission.created_at), 'dd MMM yyyy')
                          : ''}
                      </p>
                    </div>
                    <span className={cn('font-bold text-lg', levelStyles.text)}>
                      {displayAmount(Number(commission.amount || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <p className="font-medium">Payout {payout.period || ''}</p>
                    <p className="text-sm text-muted-foreground">
                      {payout.paid_at
                        ? `Payé le ${format(new Date(payout.paid_at), 'dd MMM yyyy')}`
                        : 'En attente'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>
                      {payout.status}
                    </Badge>
                    <span className="font-bold">{displayAmount(Number(payout.amount || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Partager votre lien</DialogTitle>
            <DialogDescription>
              Copiez le lien, scannez le QR code ou utilisez le partage natif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lien</Label>
              <Input readOnly value={affiliateLink} className="font-mono text-xs" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2" onClick={() => copyAffiliateLink(affiliateLink)}>
                <Copy className="h-4 w-4" /> Copier
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => shareAffiliateLink(affiliateLink)}
              >
                <Share2 className="h-4 w-4" /> Partage natif
              </Button>
            </div>
            <div className="rounded-lg border p-4 text-center bg-muted/50">
              <img
                src={qrLink}
                alt="QR code d'affiliation"
                className="mx-auto h-40 w-40 rounded-md bg-white p-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Scannez pour rejoindre Alfie Designer via votre lien.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={suffixDialogOpen} onOpenChange={setSuffixDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Personnaliser le suffixe</DialogTitle>
            <DialogDescription>
              Choisissez un identifiant lisible pour remplacer l'UUID du lien.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="suffix">Suffixe</Label>
            <Input
              id="suffix"
              value={suffixDraft}
              onChange={(event) => setSuffixDraft(event.target.value)}
              placeholder="ex: nathalie"
            />
            <p className="text-xs text-muted-foreground">
              Lettres, chiffres et tirets uniquement. Exemple : ?ref=nathalie
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuffixDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveSuffix} disabled={savingSuffix} className="gap-2">
              <Edit3 className="h-4 w-4" />
              {savingSuffix ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
