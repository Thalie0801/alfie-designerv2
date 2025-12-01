import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { callEdge } from "@/lib/edgeClient";
import { cn } from "@/lib/utils";

interface QuotaSummaryProps {
  activeBrandId: string | null;
}

interface QuotaResponse {
  woofs_quota: number;
  woofs_used: number;
  woofs_remaining: number;
  threshold_80: boolean;
  plan?: string;
  reset_date?: string;
  is_admin?: boolean;
}

export function QuotaSummary({ activeBrandId }: QuotaSummaryProps) {
  const navigate = useNavigate();
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = async () => {
    if (!activeBrandId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await callEdge<QuotaResponse>("get-quota", { brand_id: activeBrandId }, { silent: true });

      if (!result?.ok || !result.data) {
        throw new Error(result?.error || "Erreur de chargement des quotas");
      }
      setQuota(result.data);
    } catch (err: any) {
      console.error("Error fetching quota:", err);
      setError(err.message || "Erreur lors du chargement des quotas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, [activeBrandId]);

  const woofsData = useMemo(() => {
    if (!quota) return null;

    const used = quota.woofs_used;
    const total = quota.woofs_quota;
    const remaining = quota.woofs_remaining;
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

    let barColor = "bg-green-500";
    
    if (percentage >= 100) {
      barColor = "bg-red-500";
    } else if (percentage >= 80) {
      barColor = "bg-amber-400";
    }

    return { used, total, remaining, percentage, barColor };
  }, [quota]);

  if (!activeBrandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Sélectionne une marque pour voir tes quotas.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Quotas 🐶
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Quotas 🐶
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchQuota} variant="outline" size="sm" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!quota || !woofsData) return null;

  const isUnlimited = quota.is_admin || quota.woofs_quota >= 1_000_000_000;

  return (
    <Card className="bg-muted/30 border-primary/10 shadow-strong">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Quotas 🐶
          {quota.is_admin ? <Badge variant="secondary">Admin</Badge> : null}
        </CardTitle>
        <div className="flex items-center gap-2">
          {isUnlimited ? <Badge variant="secondary">Illimité</Badge> : null}
          {quota.plan ? <Badge variant="outline">Plan {quota.plan}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alerte si seuil 80% atteint */}
        {quota.threshold_80 && !isUnlimited && (
          <Alert variant="default" className="border-amber-500">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              Tu approches de la limite de ton quota mensuel. Pense à upgrader ton plan si besoin !
            </AlertDescription>
          </Alert>
        )}

        {/* Alerte si quota épuisé */}
        {woofsData.percentage >= 100 && !isUnlimited && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Tu as atteint ta limite mensuelle de Woofs. Upgrade ton plan pour continuer à créer.
            </AlertDescription>
          </Alert>
        )}

        {/* Barre de progression Woofs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Woofs utilisés ce mois-ci</span>
            <Badge variant={isUnlimited ? "outline" : "secondary"}>
              {isUnlimited ? "∞" : `${woofsData.remaining} restants`}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm tabular-nums text-muted-foreground">
            <span>
              {woofsData.used} / {isUnlimited ? "Illimité" : woofsData.total}
            </span>
            {!isUnlimited && (
              <span>
                ({woofsData.percentage}%)
              </span>
            )}
          </div>
          
          {!isUnlimited ? (
            <Progress 
              value={Math.min(120, woofsData.percentage)} 
              className={cn("h-2", woofsData.barColor)}
            />
          ) : (
            <div className="h-2 rounded-full bg-primary/20" aria-label="Quota illimité" />
          )}

          <p className="text-xs text-muted-foreground">
            {isUnlimited 
              ? "Woofs illimités 🎉" 
              : `Il te reste ${woofsData.remaining} Woofs pour créer visuels et vidéos`}
          </p>
        </div>

        {/* Info coûts */}
        <div className="pt-4 border-t space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Coûts en Woofs :</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">• Image/Slide :</span>
              <span className="font-medium">1 Woof</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">• Vidéo standard (4s) :</span>
              <span className="font-medium">10 Woofs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">• Vidéo premium (8s) :</span>
              <span className="font-medium">50 Woofs</span>
            </div>
          </div>
        </div>

        {/* CTA Upgrade si nécessaire */}
        {woofsData.percentage >= 80 && !isUnlimited && (
          <Button 
            onClick={() => navigate("/billing")} 
            variant="outline" 
            size="sm" 
            className="w-full"
          >
            Voir les plans
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
