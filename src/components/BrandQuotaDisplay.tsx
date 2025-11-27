import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Info, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { checkQuotaAlert, QuotaStatus } from '@/utils/quotaManager';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandUpgradeDialog } from './BrandUpgradeDialog';
import { WoofsPackDialog } from './WoofsPackDialog';
import { BrandTier } from '@/hooks/useBrandManagement';
import { supabase } from '@/lib/supabase';

export function BrandQuotaDisplay() {
  const { activeBrandId, activeBrand } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotas();
  }, [activeBrandId]);

  const loadQuotas = async () => {
    if (!activeBrandId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-quota', {
        body: { brand_id: activeBrandId }
      });

      if (error) throw error;

      setQuotaStatus({
        visuals: {
          used: data.visuals_used,
          limit: data.visuals_quota,
          percentage: (data.visuals_used / Math.max(1, data.visuals_quota)) * 100,
          canGenerate: data.visuals_remaining > 0
        },
        videos: {
          used: data.woofs_used,
          limit: data.woofs_quota,
          percentage: (data.woofs_used / Math.max(1, data.woofs_quota)) * 100,
          canGenerate: data.woofs_remaining > 0
        },
        woofs: {
          consumed: data.woofs_used,
          limit: data.woofs_quota,
          remaining: data.woofs_remaining,
          canUse: (cost: number) => data.woofs_remaining >= cost
        },
        brandName: activeBrand?.name,
        plan: data.plan,
        resetsOn: data.reset_date
      });
    } catch (error) {
      console.error('Error loading quotas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !quotaStatus) {
    return null;
  }

  const alert = checkQuotaAlert(quotaStatus);
  const woofsLeft = quotaStatus.woofs.remaining;
  const imagesLeft = quotaStatus.visuals.limit - quotaStatus.visuals.used;

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
            Plan {quotaStatus.plan} · Reset le {new Date(quotaStatus.resetsOn || '').toLocaleDateString('fr-FR')}
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
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Visuels</span>
            <span className="text-muted-foreground">
              {quotaStatus.visuals.used} / {quotaStatus.visuals.limit} ({quotaStatus.visuals.percentage.toFixed(0)}%)
            </span>
          </div>
          <Progress 
            value={Math.min(quotaStatus.visuals.percentage, 100)} 
            className="h-2"
          />
        </div>

        {/* Vidéos */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Vidéos</span>
            <span className="text-muted-foreground">
              {quotaStatus.videos.used} / {quotaStatus.videos.limit} ({quotaStatus.videos.percentage.toFixed(0)}%)
            </span>
          </div>
          <Progress 
            value={Math.min(quotaStatus.videos.percentage, 100)} 
            className="h-2"
          />
        </div>

        {/* Woofs */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Woofs</span>
            <span className="text-muted-foreground">
              {quotaStatus.woofs.consumed} / {quotaStatus.woofs.limit} ({((quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100).toFixed(0)}%)
            </span>
          </div>
          <Progress 
            value={Math.min((quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100, 100)} 
            className="h-2"
          />
        </div>
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
