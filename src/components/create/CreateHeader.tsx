import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBrandKit } from '@/hooks/useBrandKit';
import { getQuotaStatus, QuotaStatus } from '@/utils/quotaManager';
import { Eraser } from 'lucide-react';
import { QuotaCapsules } from '@/components/quota/QuotaCapsules';
import { useQuotaResetDate, formatResetDate } from '@/hooks/useQuotaResetDate';

interface CreateHeaderProps {
  onClearChat?: () => void;
}

export function CreateHeader({ onClearChat }: CreateHeaderProps) {
  const { brandKit, activeBrandId } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);

  const brandName = brandKit?.name ?? 'Aeditus';

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        if (!activeBrandId) {
          if (mounted) {
            setQuotaStatus(null);
          }
          return;
        }
        const status = await getQuotaStatus(activeBrandId);
        if (mounted) setQuotaStatus(status ?? null);
      } catch {
        if (mounted) setQuotaStatus(null);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [activeBrandId]);

  const planLabel = useMemo(() => {
    const p = quotaStatus?.plan;
    if (!p) return 'Studio';
    return p.charAt(0).toUpperCase() + p.slice(1);
  }, [quotaStatus?.plan]);

  const resetDateObj = useQuotaResetDate({ current_period_end: quotaStatus?.resetsOn });
  const resetDate = formatResetDate(resetDateObj);

  // valeurs sûres pour éviter les crashes si quotaStatus est null/incomplet
  const visuals = quotaStatus?.visuals ?? { used: 0, limit: 0, percentage: 0 };
  const videos = quotaStatus?.videos ?? { used: 0, limit: 0, percentage: 0 };
  const woofs = quotaStatus?.woofs ?? { consumed: 0, remaining: 0, limit: 0 };

  const hasBrandAndQuotas = !!brandKit && !!quotaStatus;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-[1200px] px-4 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            {/* Infos principales marque/plan/reset */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="text-lg font-semibold text-slate-900">{brandName}</span>
              <span>·</span>
              <span className="font-medium capitalize">{planLabel}</span>
              <span>·</span>
              <span>Reset&nbsp;: {resetDate}</span>
            </div>

            <div className="flex items-center gap-2">
              {hasBrandAndQuotas && (
                <QuotaCapsules visuals={visuals} videos={videos} woofs={woofs} />
              )}

              {onClearChat && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearChat}
                  className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Nettoyer le chat
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
