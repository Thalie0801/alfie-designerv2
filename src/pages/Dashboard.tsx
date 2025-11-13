import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, MessageSquare, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NewsWidget } from '@/components/NewsWidget';
import { FeatureRequestDialog } from '@/components/FeatureRequestDialog';
import { AccessGuard } from '@/components/AccessGuard';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { ActiveBrandCard } from '@/components/dashboard/ActiveBrandCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityCard } from '@/components/dashboard/ActivityCard';
import { RecentCreations } from '@/components/dashboard/RecentCreations';
import { ProfileProgress } from '@/components/dashboard/ProfileProgress';
import { useAffiliateStatus } from '@/hooks/useAffiliateStatus';
import { useBrandKit } from '@/hooks/useBrandKit';
import { TourProvider, HelpLauncher } from '@/components/tour/InteractiveTour';
import { DashboardTourAutoStart } from '@/components/tour/DashboardTourAutoStart';
import { BrandPaymentSuccess } from '@/components/BrandPaymentSuccess';
import { BrandManager } from '@/components/BrandManager';
import { callEdge } from '@/lib/edgeClient';

interface ImageQuotaSummary {
  used: number;
  total: number;
  plan?: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { affiliate } = useAffiliateStatus();
  const { activeBrandId } = useBrandKit();
  const [imageQuota, setImageQuota] = useState<ImageQuotaSummary | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!activeBrandId) {
      setImageQuota(null);
      setQuotaError(null);
      setQuotaLoading(false);
      return;
    }

    setQuotaLoading(true);
    setQuotaError(null);

    callEdge<{ visuals_used?: number; visuals_quota?: number; plan?: string }>(
      'get-quota',
      { brand_id: activeBrandId },
      { silent: true }
    )
      .then((response) => {
        if (cancelled) return;
        if (response.ok && response.data) {
          const { visuals_used = 0, visuals_quota = 0, plan = null } = response.data;
          setImageQuota({ used: visuals_used, total: visuals_quota, plan });
        } else if (response.ok) {
          setImageQuota({ used: 0, total: 0, plan: response.data?.plan ?? null });
        } else {
          setImageQuota(null);
          setQuotaError('Quotas indisponibles');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setImageQuota(null);
        setQuotaError('Quotas indisponibles');
      })
      .finally(() => {
        if (!cancelled) {
          setQuotaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);


  return (
    <AccessGuard>
      <TourProvider options={{ userEmail: user?.email }}>
        <BrandPaymentSuccess />
        <DashboardTourAutoStart />
        
        <div className="space-y-6 lg:space-y-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 
                  data-tour-id="nav-dashboard"
                  className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                >
                  Bienvenue sur votre Dashboard
                </h1>
              {affiliate && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white gap-1.5 px-3 py-1">
                  <Award className="h-4 w-4" />
                  Ambassadeur {affiliate.affiliate_status === 'leader' ? '· Leader' : affiliate.affiliate_status === 'mentor' ? '· Mentor' : ''}
                </Badge>
              )}
            </div>
            <p className="text-base text-muted-foreground max-w-2xl">
              Gérez vos marques, générez du contenu créatif avec Alfie et suivez vos quotas
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <HelpLauncher />
            <div data-tour-id="news">
              <NewsWidget />
            </div>
            <div data-tour-id="suggest">
              <FeatureRequestDialog />
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        <AlertBanner />

        {/* Alfie Designer Hero Card */}
        <Card className="border-none shadow-strong overflow-hidden relative group">
          <div className="absolute inset-0 gradient-hero opacity-10"></div>
          <CardContent className="relative p-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="absolute inset-0 gradient-hero blur-xl opacity-50 animate-pulse-soft"></div>
                  <div className="relative gradient-hero p-4 rounded-2xl shadow-glow">
                    <Sparkles className="h-10 w-10 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl lg:text-3xl font-bold">Alfie Designer</h2>
                  <p className="text-muted-foreground text-lg">Votre assistant créatif IA nouvelle génération</p>
                </div>
              </div>
              <Button 
                data-tour-id="btn-create"
                onClick={() => navigate('/app')}
                size="lg"
                className="gap-3 gradient-hero text-white shadow-strong hover:shadow-glow transition-all px-8 py-6 text-base font-semibold"
              >
                <MessageSquare className="h-5 w-5" />
                Commencer à créer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-dashed border-primary/20 bg-muted/20">
          <CardContent className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Suivi des quotas visuels</p>
              <p className="text-lg font-semibold">
                {quotaLoading
                  ? 'Images utilisées : chargement…'
                  : `Images utilisées : ${imageQuota?.used ?? 0} / ${
                      imageQuota && imageQuota.total > 0 ? imageQuota.total : '∞'
                    } (${imageQuota?.plan ? `plan ${imageQuota.plan}` : 'plan actuel'})`}
              </p>
              {quotaError && !quotaLoading ? (
                <p className="text-sm text-destructive">{quotaError}</p>
              ) : null}
            </div>
            {imageQuota && imageQuota.total > 0 && !quotaLoading && !quotaError ? (
              <Badge variant="outline" className="whitespace-nowrap">
                Restant : {Math.max(0, imageQuota.total - imageQuota.used)}
              </Badge>
            ) : null}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div data-tour-id="quick-actions">
          <QuickActions />
        </div>

        {/* Main Grid - Active Brand + Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          <ActiveBrandCard />
          <div data-tour-id="quotas">
            <ActivityCard activeBrandId={activeBrandId} />
          </div>
        </div>

        {/* Recent Creations */}
        <RecentCreations />

        {/* Bottom Grid - Profile Progress + Pro Tip */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ProfileProgress />
          
          <Card className="border-secondary/20 shadow-medium md:col-span-2 lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-secondary/10 flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-secondary" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">💡 Conseil Pro</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Configurez vos Brand Kits avec votre palette de couleurs, typographie et voix de marque. 
                    Alfie s'en servira pour générer du contenu parfaitement adapté à votre identité visuelle.
                    Plus votre Brand Kit est complet, plus les créations seront personnalisées et cohérentes avec votre image de marque.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Brand Manager */}
        <div data-tour-id="brand-kit">
          <BrandManager />
        </div>
        </div>
      </TourProvider>
    </AccessGuard>
  );
}
