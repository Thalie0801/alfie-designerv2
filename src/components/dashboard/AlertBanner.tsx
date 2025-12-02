import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info, Palette } from "lucide-react";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useActivityStats } from "@/hooks/useActivityStats";
import { BrandDialog } from "@/components/BrandDialog";
import { BrandUpgradeDialog } from "@/components/BrandUpgradeDialog";
import { BrandTier } from "@/hooks/useBrandManagement";
import { useAuth } from "@/hooks/useAuth";

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

function human(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  return new Intl.NumberFormat("fr-FR").format(n);
}

/**
 * Parent léger : NE fait que récupérer la brand active et
 * ne rend l'enfant que lorsque la brand est disponible.
 * -> Aucun hook conditionnel ici.
 */
export function AlertBanner() {
  const { activeBrand } = useBrandKit() as {
    activeBrand: Brand | null;
  };

  if (!activeBrand) return null; // pas d'enfant monté => aucun hook d'enfant appelé

  return <AlertBannerInner brand={activeBrand} />;
}

/**
 * Enfant : contient l'appel à useActivityStats qui dépend de brand.id.
 * Cet enfant n'est monté que quand la brand existe,
 * donc le nombre de hooks du parent ne varie jamais.
 */
function AlertBannerInner({ brand }: { brand: Brand }) {
  const { id: brandId, name, palette, voice, canva_connected, plan } = brand;
  const { isAdmin } = useAuth();

  // ✅ Toujours appelé, car ce composant n'est monté que si brand est défini
  const { stats } = useActivityStats(brandId);
  const [showBrandDialog, setShowBrandDialog] = useState(false);

  // Valeurs par défaut quand stats n'est pas encore chargée
  const {
    imagesCount = 0,
    imagesQuota = 0,
    videosCount = 0,
    videosQuota = 0,
    totalWoofsUsed = 0,
    woofsQuota = 0,
  } = stats || {};

  const usage = useMemo(() => {
    const items = [
      { key: "Visuels", used: imagesCount, quota: imagesQuota },
      { key: "Vidéos", used: videosCount, quota: videosQuota },
      { key: "Woofs", used: totalWoofsUsed, quota: woofsQuota },
    ];

    const anyNear = items.some((i) => nearQuota(i.used, i.quota));
    const anyOver = items.some((i) => overQuota(i.used, i.quota));
    const mostCritical =
      items
        .map((i) => ({ ...i, pct: percentSafe(i.used, i.quota) }))
        .sort((a, b) => b.pct - a.pct)[0] || { key: "", used: 0, quota: 0, pct: 0 };

    return { items, anyNear, anyOver, mostCritical };
  }, [imagesCount, imagesQuota, videosCount, videosQuota, totalWoofsUsed, woofsQuota]);

  // Si les stats n'ont pas encore été chargées, on ne montre rien (évite le flicker)
  if (!stats) return null;

  // ✅ NOUVEAU : Ne pas afficher l'alerte de quota pour les admins (bypass illimité)
  if (isAdmin) {
    // Passer directement aux alertes Brand Kit/Canva (pas d'alerte quota)
  } else if (usage.anyNear || usage.anyOver) {
    // 1) Quota critique (near or over) pour les non-admins
    const pct = Math.round(percentSafe(usage.mostCritical.used, usage.mostCritical.quota));
    const remaining =
      usage.mostCritical.quota > 0 ? Math.max(0, usage.mostCritical.quota - (usage.mostCritical.used ?? 0)) : 0;

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
                  ({human(usage.mostCritical.used ?? 0)} / {human(usage.mostCritical.quota ?? 0)} · {pct}%) —{" "}
                  {human(remaining)} restant(s)
                </>
              ) : (
                <>Aucun quota défini pour {usage.mostCritical.key.toLowerCase()}</>
              )}
            </span>
          </span>

          <BrandUpgradeDialog
            brandId={brandId}
            brandName={name}
            currentTier={(plan as BrandTier) || "starter"}
          />
        </AlertDescription>
      </Alert>
    );
  }

  // 2) Brand Kit incomplet
  const hasPalette = !!(palette && palette.length > 0);
  const hasVoice = !!voice;

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBrandDialog(true)}
              className="gap-2"
            >
              <Palette className="h-4 w-4" />
              Compléter
            </Button>
          </AlertDescription>
        </Alert>

        {showBrandDialog && (
          <BrandDialog brand={brand} onSuccess={() => setShowBrandDialog(false)} />
        )}
      </>
    );
  }

  // 3) Canva non connecté
  if (!canva_connected) {
    return (
      <Alert className="mb-4 border-accent/50 bg-accent/5">
        <Info className="h-4 w-4 text-accent-foreground" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
          <span>{PALETTE} Connecte Canva pour exporter directement tes créations</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // brancher ton handler réel ici (modal, route d'intégration, etc.)
              // e.g. openCanvaConnectModal() ou navigate('/integrations/canva')
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
