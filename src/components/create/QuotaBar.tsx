import { useState, useEffect } from 'react';
import { callEdge } from '@/lib/edgeClient';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface QuotaData {
  woofs_quota: number;
  woofs_used: number;
  woofs_remaining: number;
  visuals_quota: number;
  visuals_used: number;
  visuals_remaining: number;
  plan: string;
  reset_date: string | null;
}

interface QuotaBarProps {
  activeBrandId: string | null;
}

export function QuotaBar({ activeBrandId }: QuotaBarProps) {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuota();
  }, [activeBrandId]);

  const fetchQuota = async () => {
    if (!activeBrandId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await callEdge('get-quota', { brand_id: activeBrandId }, { silent: true });

      if (!result.ok) {
        throw new Error(result.error || 'Erreur de chargement des quotas');
      }

      setQuota(result.data);
    } catch (err: any) {
      console.error('Error fetching quota:', err);
      setError(err.message || 'Erreur de chargement des quotas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    );
  }

  if (error || !quota) {
    return (
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>{error || 'Aucune marque active'}</span>
        </div>
      </div>
    );
  }

  const visualsPercent = Math.round((quota.visuals_used / quota.visuals_quota) * 100);
  const woofsPercent = Math.round((quota.woofs_used / quota.woofs_quota) * 100);

  const getQuotaColor = (percent: number) => {
    if (percent >= 90) return 'text-destructive';
    if (percent >= 70) return 'text-accent';
    return 'text-muted-foreground';
  };

  const formatResetDate = (date: string | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <details className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border group">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors list-none">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-medium ${getQuotaColor(visualsPercent)}`}>
            <span className="text-xs">📸</span>
            <span>
              Visuels : {quota.visuals_remaining}/{quota.visuals_quota}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm font-medium ${getQuotaColor(woofsPercent)}`}>
            <span className="text-xs">🐾</span>
            <span>
              Woofs : {quota.woofs_remaining}/{quota.woofs_quota}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Reset : {formatResetDate(quota.reset_date)}
          </span>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
            ▼
          </span>
        </div>
      </summary>
      
      <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border bg-muted/30">
        <div className="py-3 space-y-2">
          <p className="font-medium text-foreground">💡 Astuces pour économiser tes quotas</p>
          <ul className="space-y-1 text-xs">
            <li>• <span className="font-medium">Draft 10s</span> : Version vidéo courte et économique (1 Woof)</li>
            <li>• <span className="font-medium">Batch de nuit</span> : Génère plusieurs assets d'un coup</li>
            <li>• <span className="font-medium">Templates Canva</span> : Adaptation gratuite avec ton Brand Kit</li>
          </ul>
          <p className="text-xs pt-1">
            Les quotas se réinitialisent le 1er de chaque mois. Plan actuel : <span className="font-semibold text-foreground">{quota.plan}</span>
          </p>
        </div>
      </div>
    </details>
  );
}
