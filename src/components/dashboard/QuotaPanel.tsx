import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrandKit } from "@/hooks/useBrandKit";
import { callEdge } from "@/lib/edgeClient";

interface QuotaResponse {
  woofs_quota: number;
  woofs_used: number;
  visuals_quota: number;
  visuals_used: number;
  videos_quota: number;
  videos_used: number;
  plan: string;
  reset_date: string | null;
}

function clampPercent(used: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

function formatReset(date: string | null | undefined) {
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    }
  }

  const today = new Date();
  const nextReset = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextReset.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function DetailRow({ label, used, total }: { label: string; used: number; total: number }) {
  const safeUsed = Math.max(0, used);
  const safeTotal = Math.max(0, total);
  const display = safeTotal > 0 ? `${safeUsed}/${safeTotal}` : `${safeUsed}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{display}</span>
      </div>
      <Progress value={clampPercent(safeUsed, safeTotal)} />
    </div>
  );
}

export function QuotaPanel() {
  const { activeBrandId } = useBrandKit();
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadQuota = async () => {
      if (!activeBrandId) {
        setQuota(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await callEdge<QuotaResponse>("get-quota", { brand_id: activeBrandId }, { silent: true });
        if (!mounted) return;
        if (result.ok && result.data) {
          setQuota(result.data);
        } else {
          setError(result.error || "Impossible de récupérer les quotas");
          setQuota(null);
        }
      } catch (err) {
        console.error("[QuotaPanel] load error", err);
        if (mounted) {
          setQuota(null);
          setError("Erreur de chargement des quotas");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadQuota();
    return () => {
      mounted = false;
    };
  }, [activeBrandId]);

  const planLabel = useMemo(() => {
    const plan = quota?.plan;
    if (!plan) return "Studio";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }, [quota?.plan]);

  const resetLabel = formatReset(quota?.reset_date);
  const woofsCap = Math.max(0, quota?.woofs_quota ?? 0);
  const woofsUsed = Math.max(0, quota?.woofs_used ?? 0);
  const woofsPct = woofsCap > 0 ? clampPercent(woofsUsed, woofsCap) : 0;
  const woofsSummary = woofsCap > 0 ? `${woofsUsed}/${woofsCap} Woof${woofsCap > 1 ? "s" : ""}` : `${woofsUsed} Woof${woofsUsed > 1 ? "s" : ""}`;

  const canDisplayDetails = Boolean(activeBrandId && !loading && (quota || error));

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-xl bg-card">
      <div className="flex items-center justify-between p-3">
        <div className="text-sm font-medium text-foreground">
          {`Plan : ${planLabel}`} <span className="text-muted-foreground">· Reset : {resetLabel}</span>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" disabled={!canDisplayDetails}>
            Détails quotas
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </div>

      <div className="px-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <>
            <Progress value={woofsPct} className="h-2" />
            <div className="mt-1 text-xs text-muted-foreground">{woofsSummary}</div>
          </>
        )}
      </div>

      <CollapsibleContent className="px-3 pb-3 text-sm text-muted-foreground space-y-4" forceMount>
        {!activeBrandId ? (
          <p>Sélectionnez une marque active pour suivre vos quotas.</p>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        ) : error ? (
          <p>{error}</p>
        ) : quota ? (
          <>
            <div className="space-y-3">
              <DetailRow label="Woofs" used={woofsUsed} total={woofsCap} />
              <DetailRow label="Visuels IA" used={quota.visuals_used} total={quota.visuals_quota} />
              <DetailRow label="Vidéos" used={quota.videos_used} total={quota.videos_quota} />
            </div>

            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Draft 10s : version vidéo courte et économique (1 Woof).</li>
              <li>• Batch de nuit : génère plusieurs assets d’un coup.</li>
              <li>• Templates : adaptation auto avec ton Brand Kit.</li>
            </ul>

            <p className="mt-2 text-xs text-muted-foreground">
              Les vidéos consomment des Woofs (1 Woof / 12s). Les quotas se réinitialisent le 1er de chaque mois.
            </p>
          </>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
