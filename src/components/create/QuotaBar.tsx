import { useEffect, useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { callEdge } from "@/lib/edgeClient";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface QuotaBarProps {
  activeBrandId: string | null;
}

interface QuotaData {
  woofs_used: number;
  woofs_quota: number;
  woofs_remaining: number;
  threshold_80: boolean;
  plan?: string;
  reset_date?: string;
  is_admin?: boolean;
}

function clampPct(n: number) {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pct(used: number, quota: number) {
  if (!quota || quota <= 0) return 0;
  return clampPct((used / quota) * 100);
}

function colorFor(percent: number) {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-amber-400";
  return "bg-green-500";
}

function formatReset(date: string | null) {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const HIDE_BACKEND_BADGES = (import.meta as any)?.env?.VITE_HIDE_BACKEND_BADGES === "true";

export function QuotaBar({ activeBrandId }: QuotaBarProps) {
  const navigate = useNavigate();
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchQuota = async () => {
      if (!activeBrandId) {
        if (mounted) {
          setQuota(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await callEdge("get-quota", { brand_id: activeBrandId }, { silent: true });

        if (!result?.ok) {
          throw new Error(result?.error || "Erreur de chargement des quotas");
        }
        if (mounted) setQuota(result.data as QuotaData);
      } catch (err: any) {
        console.error("Error fetching quota:", err);
        if (mounted) setError(err?.message || "Erreur de chargement des quotas");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchQuota();
    return () => {
      mounted = false;
    };
  }, [activeBrandId]);

  const woofsPercent = useMemo(() => pct(quota?.woofs_used ?? 0, quota?.woofs_quota ?? 0), [quota]);

  if (loading) {
    return (
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    );
  }

  if (error || !quota) {
    return (
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{error || "Aucune marque active"}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="h-7 px-2">
            <RefreshCcw className="h-3.5 w-3.5 mr-1" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const woofsLeft = Math.max(0, quota.woofs_remaining ?? 0);
  const woofsQuota = Math.max(0, quota.woofs_quota ?? 0);
  const isUnlimited = quota.is_admin || woofsQuota >= 1_000_000_000;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="sticky top-0 z-30 bg-gradient-to-r from-background via-background/98 to-background backdrop-blur-xl border-b border-border/50 shadow-sm">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-all duration-200">
          <div className="flex items-center gap-3">
            {!HIDE_BACKEND_BADGES ? (
              <div className="flex flex-col gap-1 min-w-[88px]">
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 text-sm font-semibold border border-orange-200 dark:border-orange-800 shadow-sm",
                  )}
                  title="Woofs (crédits unifiés)"
                >
                  <span className="text-xs" aria-hidden>
                    🐾
                  </span>
                  <span className="text-xs">{isUnlimited ? "∞" : `${woofsLeft}/${woofsQuota}`}</span>
                </div>
                <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-500", colorFor(woofsPercent))}
                    style={{ width: `${woofsPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span>Woofs : {isUnlimited ? "∞" : `${woofsLeft}/${woofsQuota}`}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md"
              title="Date de réinitialisation des quotas"
            >
              Reset : {formatReset(quota.reset_date ?? null)}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border bg-muted/30">
          <div className="py-3 space-y-3">
            {/* Détails quota */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Utilisés :</span>
                <span className="font-medium">{quota.woofs_used} Woofs</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total mensuel :</span>
                <span className="font-medium">
                  {isUnlimited ? "∞" : `${woofsQuota} Woofs`}
                </span>
              </div>
              {quota.plan && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan :</span>
                  <span className="font-medium capitalize">{quota.plan}</span>
                </div>
              )}
            </div>

            {/* Coûts */}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Coûts en Woofs :</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Image / Slide de carrousel : <strong>1 Woof</strong></li>
                <li>• Vidéo animée standard : <strong>10 Woofs</strong></li>
                <li>• Vidéo premium (Veo 3.1) : <strong>50 Woofs</strong></li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Les quotas se réinitialisent le 1er de chaque mois.
              </p>
            </div>

            {/* Alerte seuil */}
            {quota.threshold_80 && !isUnlimited && (
              <div className="pt-3 border-t">
                <div className="flex items-start gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">
                    Tu approches de la limite ! Pense à upgrader ton plan.
                  </p>
                </div>
              </div>
            )}

            {/* CTA Upgrade */}
            {woofsPercent >= 80 && !isUnlimited && (
              <Button 
                onClick={() => navigate("/billing")} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
              >
                Voir les plans
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
