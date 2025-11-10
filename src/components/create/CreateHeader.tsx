import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBrandKit } from '@/hooks/useBrandKit';
import { getQuotaStatus, QuotaStatus } from '@/utils/quotaManager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Info, ChevronDown, Eraser, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLAGS } from '@/config/flags';

interface CreateHeaderProps {
  onClearChat?: () => void;
}

function clampPct(n: number | undefined) {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, v));
}

function formatResetDate(resetsOn?: string | null) {
  if (resetsOn) {
    try {
      const d = new Date(resetsOn);
      // Ex: "7 novembre"
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch {
      /* ignore */
    }
  }
  // Fallback: 1er du mois prochain
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return next.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function CreateHeader({ onClearChat }: CreateHeaderProps) {
  const { brandKit, activeBrandId } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const brandName = brandKit?.name ?? 'Aeditus';

  // Option 2 (Cloudinary-only) : pas de backend vidéo IA
  const ffmpegBackend = import.meta.env.VITE_FFMPEG_BACKEND_URL as string | undefined;
  const isVideoIADisabled = !FLAGS.VIDEO || !ffmpegBackend; // on affiche un bandeau d’info dans le popover

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
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
      } finally {
        if (mounted) setLoading(false);
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

  const resetDate = formatResetDate(quotaStatus?.resetsOn ?? null);

  // valeurs sûres pour éviter les crashes si quotaStatus est null/incomplet
  const visuals = quotaStatus?.visuals ?? { used: 0, limit: 0, percentage: 0 };
  const videos = quotaStatus?.videos ?? { used: 0, limit: 0, percentage: 0 };
  const woofs = quotaStatus?.woofs ?? { consumed: 0, remaining: 0, limit: 0 };

  const visualsRemaining =
    typeof visuals.limit === 'number' && typeof visuals.used === 'number'
      ? Math.max(0, visuals.limit - visuals.used)
      : 0;

  const videosRemaining =
    typeof videos.limit === 'number' && typeof videos.used === 'number'
      ? Math.max(0, videos.limit - videos.used)
      : 0;

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

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'rounded-full border-slate-200 text-slate-700 hover:bg-slate-100',
                      isVideoIADisabled && 'border-amber-300'
                    )}
                    disabled={loading || !hasBrandAndQuotas}
                  >
                    <Info className="mr-2 h-4 w-4" />
                    Quotas détaillés
                    <ChevronDown className="ml-2 h-3 w-3" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-96" align="end">
                  {hasBrandAndQuotas ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <h4 className="font-semibold">Quotas de {brandName}</h4>
                        <p className="text-xs text-slate-500">
                          Confection Canva : incluse et non comptabilisée.
                        </p>
                        {isVideoIADisabled && (
                          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p className="text-xs">
                              <strong>Mode Cloudinary-only :</strong> la vidéo IA est désactivée (pas
                              de backend). Les montages vidéo simples (images→vidéo, concat) restent disponibles
                              via Cloudinary et ne consomment pas de quotas “Vidéos IA”.
                            </p>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Visuels IA */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Visuels IA</span>
                          <span className="font-medium">
                            {visualsRemaining}/{visuals.limit || 0}
                          </span>
                        </div>
                        <Progress value={clampPct(visuals.percentage)} />
                      </div>

                      {/* Vidéos IA (désactivées si pas de backend) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className={cn(isVideoIADisabled && 'text-slate-400')}>
                            Vidéos IA
                          </span>
                          <span className="font-medium">
                            {videosRemaining}/{videos.limit || 0}
                          </span>
                        </div>
                        <Progress value={clampPct(videos.percentage)} />
                      </div>

                      {/* Woofs */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Woofs</span>
                          <span className="font-medium">
                            {woofs.remaining}/{woofs.limit || 0}
                          </span>
                        </div>
                        <Progress value={clampPct(100 - (woofs.remaining / (woofs.limit || 1)) * 100)} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Chargement...</p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
