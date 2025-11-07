import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info, Palette } from "lucide-react";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useActivityStats } from "@/hooks/useActivityStats";
import { BrandDialog } from "@/components/BrandDialog";
import { BrandUpgradeDialog } from "@/components/BrandUpgradeDialog";
import { BrandTier } from "@/hooks/useBrandManagement";

type Plan = BrandTier | "starter" | string;

interface Brand {
  id: string;
  name: string;
  palette?: string[] | null;
  voice?: string | null;
  canva_connected?: boolean;
  plan?: Plan | null;
}

const CRITICAL_THRESHOLD = 90; // %
const WARN_EMOJI = "⚠️";
const LIGHTBULB = "💡";
const PALETTE = "🎨";

function percentSafe(used?: number, quota?: number) {
  if (!quota || quota <= 0) return 0;
  const p = ((used ?? 0) / quota) * 100;
  return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0;
}

function nearQuota(used?: number, quota?: number, thresholdPct = CRITICAL_THRESHOLD) {
  const p = percentSafe(used, quota);
  return p >= thresholdPct;
}

function overQuota(used?: number, quota?: number) {
  return !!quota && (used ?? 0) > quota;
}

function human(n: number | undefined) {
  return new Intl.NumberFormat("fr-FR").format(n ?? 0);
}

export function AlertBanner() {
  const { activeBrand, activeBrandId } = useBrandKit() as {
    activeBrand: Brand | null;
    activeBrandId: string | null;
  };
  const { stats } = useActivityStats(activeBrandId);
  const [showBrandDialog, setShowBrandDialog] = useState(false);

  if (!activeBrand || !stats) return null;

  // -- Quotas
  const {
    imagesCount = 0,
    imagesQuota = 0,
    videosCount = 0,
    videosQuota = 0,
    totalWoofsUsed = 0,
    woofsQuota = 0,
  } = stats;

  const usage = useMemo(() => {
    const items = [
      { key: "Visuels", used: imagesCount, quota: imagesQuota },
      { key: "Vidéos", used: videosCount, quota: videosQuota },
      { key: "Woofs", used: totalWoofsUsed, quota: woofsQuota },
    ];

    const anyNear = items.some((i) => nearQuota(i.used, i.quota));
    const anyOver = items.some((i) => overQuota(i.used, i.quota));
    const mostCritical = items
      .map((i) => ({ ...i, pct: percentSafe(i.used, i.quota) }))
      .sort((a, b) => b.pct - a.pct)[0];

    return { items, anyNear, anyOver, mostCritical };
  }, [imagesCount, imagesQuota, videosCount, videosQuota, totalWoofsUsed, woofsQuota]);

  // 1) Quota critique (near or over)
  if (usage.anyNear || usage.anyOver) {
    const k = usage.mostCritical.key.toLowerCase();
    const pct = Math.round(percentSafe(usage.mostCritical.used, usage.mostCritical.quota));
    const remaining =
      usage.mostCritical.quota > 0 ? Math.max(0, usage.mostCritical.quota - usage.mostCritical.used) : 0;

    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
          <span>
            {WARN_EMOJI}{" "}
            {usage.anyOver ? (
              <>Dépassement de quota détecté ({usage.mostCritical.key}).</>
            ) : (
              <>Plus que 10% de tes quotas disponibles ce mois !</>
            )}{" "}
            <span className="text-xs text-muted-foreground">
              {usage.mostCritical.quota > 0 ? (
                <>
                  ({human(usage.mostCritical.used)} / {human(usage.mostCritical.quota)} · {pct}%) — {human(remaining)}{" "}
                  restant(s)
                </>
              ) : (
                <>Aucun quota défini pour {k}</>
              )}
            </span>
          </span>

          <BrandUpgradeDialog
            brandId={activeBrand.id}
            brandName={activeBrand.name}
            currentTier={(activeBrand.plan as BrandTier) || "starter"}
          />
        </AlertDescription>
      </Alert>
    );
  }

  // 2) Brand Kit incomplet
  const hasPalette = !!(activeBrand.palette && activeBrand.palette.length > 0);
  const hasVoice = !!activeBrand.voice;

  if (!hasPalette || !hasVoice) {
    return (
      <>
        <Alert className="mb-4 border-primary/50 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
            <span>
              {LIGHTBULB} Complète ton Brand Kit pour des générations plus personnalisées
              {!hasPalette && " · palette manquante"}
              {!hasVoice && !hasPalette && " ·"}
              {!hasVoice && " ton de marque manquant"}
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowBrandDialog(true)} className="gap-2">
              <Palette className="h-4 w-4" />
              Compléter
            </Button>
          </AlertDescription>
        </Alert>

        {showBrandDialog && (
          <BrandDialog
            brand={activeBrand}
            onSuccess={() => setShowBrandDialog(false)}
          />
        )}
      </>
    );
  }

  // 3) Canva non connecté
  if (!activeBrand.canva_connected) {
    return (
      <Alert className="mb-4 border-accent/50 bg-accent/5">
        <Info className="h-4 w-4 text-accent-foreground" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
          <span>{PALETTE} Connecte Canva pour exporter directement tes créations</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: branche ton handler réel ici
              // e.g. openCanvaConnectModal() ou router.push('/integrations/canva')
            }}
          >
            Connecter Canva
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
