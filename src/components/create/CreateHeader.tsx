import { useEffect, useState } from 'react';
import { HelpCircle, History } from 'lucide-react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { getQuotaStatus, QuotaStatus } from '@/utils/quotaManager';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CreateHeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function CreateHeader({ onToggleSidebar, isSidebarOpen }: CreateHeaderProps) {
  const { brandKit, activeBrandId } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!activeBrandId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadQuotas = async () => {
      setLoading(true);
      const status = await getQuotaStatus(activeBrandId);
      if (!cancelled) {
        setQuotaStatus(status);
        setLoading(false);
      }
    };

    loadQuotas();

    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);

  const resetDate = quotaStatus?.resetsOn
    ? new Date(quotaStatus.resetsOn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : '1 nov.';

  const visualsValue = quotaStatus
    ? `${Math.max(quotaStatus.visuals.limit - quotaStatus.visuals.used, 0)}/${quotaStatus.visuals.limit}`
    : '1000/1000';
  const woofsValue = quotaStatus
    ? `${quotaStatus.woofs.remaining}/${quotaStatus.woofs.limit}`
    : '100/100';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Créer</h1>
              <p className="text-sm text-slate-500">Atelier d’idées</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
                    >
                      Bientôt
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Nouveaux workflows à venir
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{brandKit?.name ?? 'Marque active'}</span>
            <span className="hidden sm:inline">•</span>
            <span className="capitalize">{quotaStatus?.plan ?? 'Plan en cours'}</span>
            <span className="hidden sm:inline">•</span>
            <span>Reset: {resetDate}</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-700">
              Visuels: {loading ? '...' : visualsValue}
            </Badge>
            <Badge className="rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-700">
              Woofs: {loading ? '...' : woofsValue}
            </Badge>
            <Badge className="rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-700">
              Reset: {resetDate}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-slate-200 bg-white shadow-md hover:shadow-lg"
                    aria-label="Aide"
                  >
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Besoin d’un coup de patte ?
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSidebar}
              className="hidden rounded-full border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md transition hover:shadow-lg sm:flex"
            >
              <History className="mr-2 h-4 w-4 text-blue-600" />
              {isSidebarOpen ? 'Masquer' : 'Historique'}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
