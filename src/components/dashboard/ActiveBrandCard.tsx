import { useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette as PaletteIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBrandKit } from "@/hooks/useBrandKit";
import { BrandSelector } from "@/components/BrandSelector";
import { BrandDialog } from "@/components/BrandDialog";
import { cn } from "@/lib/utils";
import { safeString } from "@/lib/safeRender";

type Plan = "free" | "pro" | "team" | "enterprise";

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  palette?: string[];
  voice?: string | null;
  plan?: Plan | string | null;
  canva_connected?: boolean;
  is_addon?: boolean;
  pitch?: string | null;
  adjectives?: string[];
  tone_sliders?: { fun: number; accessible: number; energetic: number; direct: number; };
}

export function ActiveBrandCard() {
  const { activeBrand, totalBrands, quotaBrands, loadBrands } = useBrandKit() as {
    activeBrand?: Brand | null;
    totalBrands: number;
    quotaBrands: number;
    loadBrands: () => void;
  };

  // Auto-refresh when the active brand changes
  useEffect(() => {
    if (activeBrand?.id) {
      loadBrands();
    }
  }, [activeBrand?.id, loadBrands]);

  // Friendly quota message
  const quotaMessage = useMemo(() => {
    if (!totalBrands || totalBrands === 0) return "Crée ta première marque gratuite";
    if (totalBrands === 1 && quotaBrands === 1) return "Tu as utilisé ta marque gratuite";
    if (totalBrands > quotaBrands) return `${totalBrands - quotaBrands} marque(s) payante(s)`;
    return `${totalBrands}/${quotaBrands} marque(s) utilisées`;
  }, [totalBrands, quotaBrands]);

  const planLabel = safeString(activeBrand?.plan ?? "aucun");
  const planDisplay = planLabel.toUpperCase();
  const isFreePlan = planLabel.toLowerCase() === "free";

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PaletteIcon className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>Marque active</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono" aria-label="Quota marques">
            {totalBrands}/{quotaBrands}
          </Badge>
        </div>
        <CardDescription>{quotaMessage}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sélecteur de marque */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Sélectionner une marque
          </label>
          <BrandSelector />
        </div>

        {/* Détails de la marque active */}
        {activeBrand ? (
          <div className="space-y-4">
            {/* En-tête de la marque */}
            <div className="flex items-start justify-between p-4 rounded-lg border bg-card">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  {activeBrand.logo_url ? (
                    <img
                      src={activeBrand.logo_url}
                      alt={`Logo ${activeBrand.name}`}
                      className="w-10 h-10 object-contain rounded border bg-white"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="w-10 h-10 rounded border flex items-center justify-center text-xs font-semibold bg-muted"
                      title="Pas de logo"
                    >
                      {activeBrand?.name?.slice(0, 2)?.toUpperCase() ?? "BR"}
                    </div>
                  )}
                  <h3 className="font-semibold text-lg truncate">{activeBrand.name}</h3>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge
                    variant={isFreePlan ? "outline" : activeBrand.plan ? "secondary" : "outline"}
                    className={cn(
                      isFreePlan && "bg-alfie-mintSoft text-slate-900 border border-alfie-mint/50",
                    )}
                  >
                    {planDisplay}
                  </Badge>

                  <Badge variant={activeBrand.canva_connected ? "default" : "secondary"}>
                    {activeBrand.canva_connected ? "✓ Canva" : "○ Canva"}
                  </Badge>

                  {activeBrand.is_addon && (
                    <Badge variant="outline" className="text-xs">
                      Add-on
                    </Badge>
                  )}
                </div>
              </div>

              <BrandDialog brand={activeBrand} onSuccess={loadBrands} />
            </div>

            {/* Palette */}
            {Array.isArray(activeBrand.palette) && activeBrand.palette.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Palette</label>
                <div className="flex gap-2 flex-wrap">
                  {activeBrand.palette.map((color, index) => (
                    <button
                      type="button"
                      key={`${color}-${index}`}
                      className={cn(
                        "w-10 h-10 rounded-lg border shadow-sm ring-offset-background transition",
                        "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary",
                      )}
                      style={{ backgroundColor: color }}
                      title={`${color} — cliquer pour copier`}
                      aria-label={`Couleur ${color}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(color);
                        } catch {
                          // no-op
                        }
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Astuce : clique une couleur pour copier son code.</p>
              </div>
            )}

            {/* Pitch */}
            {activeBrand.pitch && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Pitch</label>
                <p className="text-sm text-muted-foreground italic">"{activeBrand.pitch}"</p>
              </div>
            )}

            {/* Adjectives */}
            {Array.isArray(activeBrand.adjectives) && activeBrand.adjectives.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Personnalité</label>
                <div className="flex gap-1 flex-wrap">
                  {activeBrand.adjectives.map((adj, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{adj}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tone indicators */}
            {activeBrand.tone_sliders && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Ton</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Fun/Sérieux:</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${activeBrand.tone_sliders.fun * 10}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Accessible:</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${activeBrand.tone_sliders.accessible * 10}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Voice */}
            {activeBrand.voice && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Voix de marque</label>
                <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-2">{activeBrand.voice}</p>
              </div>
            )}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>Aucune marque active. Crée ta première marque pour commencer.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
