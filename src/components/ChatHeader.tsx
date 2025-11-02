import { Button } from '@/components/ui/button';
import { Info, ChevronDown } from 'lucide-react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useState, useEffect } from 'react';
import { getQuotaStatus, QuotaStatus } from '@/utils/quotaManager';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

export function ChatHeader() {
  const { brandKit, activeBrandId } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeBrandId) {
      loadQuotas();
    } else {
      setLoading(false);
    }
  }, [activeBrandId]);

  const loadQuotas = async () => {
    if (!activeBrandId) return;
    setLoading(true);
    const status = await getQuotaStatus(activeBrandId);
    setQuotaStatus(status);
    setLoading(false);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 80) return 'bg-orange-500';
    return 'bg-primary';
  };

  if (loading || !brandKit || !quotaStatus) {
    return (
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Chargement...' : 'Aucune marque active'}
          </div>
        </div>
      </div>
    );
  }

  const resetDate = quotaStatus.resetsOn 
    ? new Date(quotaStatus.resetsOn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : '1er du mois';

  return (
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 py-3">
        {/* Ligne principale */}
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{brandKit.name}</span>
            <span>•</span>
            <span className="capitalize">{quotaStatus.plan}</span>
            <span>•</span>
            <span>Reset: {resetDate}</span>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">Quotas détaillés</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1">Quotas de {brandKit.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    Confection Canva : incluse et non comptabilisée.
                  </p>
                </div>

                <Separator />

                {/* Visuels */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Visuels IA</span>
                    <span className="font-medium">{quotaStatus.visuals.limit - quotaStatus.visuals.used}/{quotaStatus.visuals.limit}</span>
                  </div>
                  <Progress 
                    value={quotaStatus.visuals.percentage} 
                    className={getProgressColor(quotaStatus.visuals.percentage)}
                  />
                </div>

                {/* Vidéos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Vidéos IA</span>
                    <span className="font-medium">{quotaStatus.videos.limit - quotaStatus.videos.used}/{quotaStatus.videos.limit}</span>
                  </div>
                  <Progress 
                    value={quotaStatus.videos.percentage} 
                    className={getProgressColor(quotaStatus.videos.percentage)}
                  />
                </div>

                {/* Woofs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Woofs (budget vidéo)</span>
                    <span className="font-medium">{quotaStatus.woofs.remaining}/{quotaStatus.woofs.limit}</span>
                  </div>
                  <Progress 
                    value={(quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100} 
                    className={getProgressColor((quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Veo3 = 4 Woofs • Sora = 1 Woof
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
