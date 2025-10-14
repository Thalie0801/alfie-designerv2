import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Info, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getQuotaStatus, checkQuotaAlert, QuotaStatus } from '@/utils/quotaManager';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandUpgradeDialog } from './BrandUpgradeDialog';
import { WoofsPackDialog } from './WoofsPackDialog';
import { BrandTier } from '@/hooks/useBrandManagement';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

export function BrandQuotaDisplay() {
  const { activeBrandId, activeBrand } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadQuotas();
  }, [activeBrandId]);

  const loadQuotas = async () => {
    if (!activeBrandId) {
      setLoading(false);
      return;
    }

    const status = await getQuotaStatus(activeBrandId);
    setQuotaStatus(status);
    setLoading(false);
  };

  const handleNavigateToLibrary = (type: 'images' | 'videos' | 'woofs') => {
    if (!activeBrandId) return;
    const url = type === 'images'
      ? '/app/library?tab=images&period=current'
      : type === 'videos'
        ? '/app/library?tab=videos&period=current'
        : '/app/library?tab=videos&period=current&metric=woofs';
    navigate(url);
  };

  if (loading) {
    return (
      <Card className="p-4 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      </Card>
    );
  }

  if (!quotaStatus) {
    return null;
  }

  const alert = checkQuotaAlert(quotaStatus);
  const woofsLeft = quotaStatus.woofs.remaining;
  const imagesLeft = quotaStatus.visuals.limit - quotaStatus.visuals.used;
  const videosLeft = quotaStatus.videos.limit - quotaStatus.videos.used;

  return (
    <Card className="p-4 space-y-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      {/* Titre et marque */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quotas de {quotaStatus.brandName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Plan {quotaStatus.plan} · Reset le {formatResetDate(quotaStatus.resetsOn)}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-5 h-5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold mb-1">💡 Coûts vidéo</p>
              <p className="text-sm">Veo 3 = 4 Woofs · Sora = 1 Woof</p>
              <p className="text-sm mt-2">Les quotas se réinitialisent chaque 1er du mois et ne sont pas reportables.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Alerte si nécessaire */}
      {alert && (
        <Alert variant={alert.level === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {/* Message principal */}
      <p className="text-sm font-medium">
        Il vous reste <span className="font-bold text-primary">{woofsLeft} Woofs</span> et{' '}
        <span className="font-bold text-primary">{imagesLeft} visuels</span> ce mois-ci.
      </p>

      {/* Barres de progression */}
      <div className="space-y-3">
        {/* Visuels */}
        <button
          type="button"
          onClick={() => handleNavigateToLibrary('images')}
          className="space-y-1 w-full text-left rounded-lg p-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <div className="flex justify-between text-xs">
            <span className="font-medium">Visuels</span>
            <span className="text-muted-foreground">
              {quotaStatus.visuals.used} / {quotaStatus.visuals.limit} ({formatPercent(quotaStatus.visuals.percentage)}%)
            </span>
          </div>
          <Progress
            value={Math.min(quotaStatus.visuals.percentage, 100)}
            className="h-2"
          />
        </button>

        {/* Vidéos */}
        <button
          type="button"
          onClick={() => handleNavigateToLibrary('videos')}
          className="space-y-1 w-full text-left rounded-lg p-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <div className="flex justify-between text-xs">
            <span className="font-medium">Vidéos</span>
            <span className="text-muted-foreground">
              {quotaStatus.videos.used} / {quotaStatus.videos.limit} ({formatPercent(quotaStatus.videos.percentage)}%)
            </span>
          </div>
          <Progress
            value={Math.min(quotaStatus.videos.percentage, 100)}
            className="h-2"
          />
        </button>

        {/* Woofs */}
        <button
          type="button"
          onClick={() => handleNavigateToLibrary('woofs')}
          className="space-y-1 w-full text-left rounded-lg p-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <div className="flex justify-between text-xs">
            <span className="font-medium">Woofs</span>
            <span className="text-muted-foreground">
              {quotaStatus.woofs.consumed} / {quotaStatus.woofs.limit} ({formatWoofPercent(quotaStatus.woofs.consumed, quotaStatus.woofs.limit)}%)
            </span>
          </div>
          <Progress
            value={Math.min((quotaStatus.woofs.limit > 0 ? (quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100 : 0), 100)}
            className="h-2"
          />
        </button>
      </div>

      {/* Actions si proche de la limite */}
      {quotaStatus.visuals.percentage >= 80 || quotaStatus.videos.percentage >= 80 || (quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100 >= 80 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            💡 Approche de la limite ? Plusieurs options :
          </p>
          <div className="flex gap-2">
            {activeBrand && (
              <>
                <BrandUpgradeDialog
                  brandId={activeBrand.id}
                  brandName={activeBrand.name}
                  currentTier={(activeBrand as any).plan as BrandTier || 'starter'}
                  onSuccess={loadQuotas}
                />
                <WoofsPackDialog
                  brandId={activeBrand.id}
                  brandName={activeBrand.name}
                  onSuccess={loadQuotas}
                />
              </>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function formatWoofPercent(consumed: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.round((consumed / limit) * 100);
}

function formatResetDate(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
}
