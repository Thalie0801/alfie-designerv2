import { useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette as PaletteIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBrandKit } from "@/hooks/useBrandKit";
import { BrandSelector } from "@/components/BrandSelector";
import { BrandDialog } from "@/components/BrandDialog";
import { cn } from "@/lib/utils";

type Plan = "free" | "pro" | "team" | "enterprise";

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  palette?: string[]; // hex or css color strings
  voice?: string | null;
  plan?: Plan | string | null;
  canva_connected?: boolean;
  is_addon?: boolean;
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

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
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
                      {activeBrand.name?.slice(0, 2).toUpperCase() ?? "BR"}
                    </div>
                  )}
                  <h3 className="font-semibold text-lg truncate">{activeBrand.name}</h3>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge variant={activeBrand.plan ? "default" : "secondary"}>
                    {(activeBrand.plan ?? "aucun").toString().toUpperCase()}
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

            {/* Voice */}
            {activeBrand.voice && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Ton de la marque</label>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{activeBrand.voice}</p>
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
