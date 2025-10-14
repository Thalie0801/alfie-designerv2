import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBrandKit } from '@/hooks/useBrandKit';
import { getQuotaStatus, QuotaStatus } from '@/utils/quotaManager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Info, ChevronDown } from 'lucide-react';

export function CreateHeader() {
  const { brandKit, activeBrandId } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBrandId) {
      setLoading(false);
      setQuotaStatus(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const status = await getQuotaStatus(activeBrandId);
        setQuotaStatus(status);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeBrandId]);

  const hasData = !!brandKit && !!quotaStatus;
  const brandName = brandKit?.name ?? 'Aeditus';
  const planLabel = quotaStatus?.plan ? quotaStatus.plan.charAt(0).toUpperCase() + quotaStatus.plan.slice(1) : 'Studio';
  const resetDate = quotaStatus?.resetsOn
    ? new Date(quotaStatus.resetsOn).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      })
    : '1 novembre';

  const visualsRemaining = hasData
    ? `${quotaStatus!.visuals.limit - quotaStatus!.visuals.used}/${quotaStatus!.visuals.limit}`
    : '1000/1000';
  const woofsRemaining = hasData
    ? `${quotaStatus!.woofs.remaining}/${quotaStatus!.woofs.limit}`
    : '100/100';

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="max-w-[1200px] mx-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="text-lg font-semibold text-slate-900">{brandName}</span>
              <span>·</span>
              <span className="font-medium capitalize">{planLabel}</span>
              <span>·</span>
              <span>Reset&nbsp;: {resetDate}</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-100"
                  disabled={loading || !hasData}
                >
                  <Info className="mr-2 h-4 w-4" />
                  Quotas détaillés
                  <ChevronDown className="ml-2 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                {hasData ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold">Quotas de {brandName}</h4>
                      <p className="text-xs text-slate-500">Confection Canva : incluse et non comptabilisée.</p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Visuels IA</span>
                        <span className="font-medium">{quotaStatus!.visuals.limit - quotaStatus!.visuals.used}/{quotaStatus!.visuals.limit}</span>
                      </div>
                      <Progress value={quotaStatus!.visuals.percentage} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Vidéos IA</span>
                        <span className="font-medium">{quotaStatus!.videos.limit - quotaStatus!.videos.used}/{quotaStatus!.videos.limit}</span>
                      </div>
                      <Progress value={quotaStatus!.videos.percentage} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Woofs (budget vidéo)</span>
                        <span className="font-medium">{quotaStatus!.woofs.remaining}/{quotaStatus!.woofs.limit}</span>
                      </div>
                      <Progress value={(quotaStatus!.woofs.consumed / quotaStatus!.woofs.limit) * 100} />
                      <p className="text-xs text-slate-500">Veo3 = 4 Woofs • Sora = 1 Woof</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Connecte une marque pour voir les quotas détaillés.</div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              Visuels&nbsp;: {loading ? '…' : visualsRemaining}
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              Woofs&nbsp;: {loading ? '…' : woofsRemaining}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
