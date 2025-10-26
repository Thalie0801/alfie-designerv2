import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandSelector } from '@/components/BrandSelector';
import { BrandDialog } from '@/components/BrandDialog';

export function ActiveBrandCard() {
  const { activeBrand, totalBrands, quotaBrands, loadBrands } = useBrandKit();

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Marque Active</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono">
            {totalBrands}/{quotaBrands}
          </Badge>
        </div>
        <CardDescription>
          Gère ta marque et consulte tes quotas
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sélecteur de marque */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Sélectionner une marque</label>
          <BrandSelector />
        </div>

        {/* Détails de la marque active */}
        {activeBrand ? (
          <div className="space-y-4">
            {/* En-tête de la marque */}
            <div className="flex items-start justify-between p-4 rounded-lg border-2 bg-card">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  {activeBrand.logo_url && (
                    <img
                      src={activeBrand.logo_url}
                      alt={activeBrand.name}
                      className="w-10 h-10 object-contain rounded border"
                    />
                  )}
                  <h3 className="font-semibold text-lg">{activeBrand.name}</h3>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={(activeBrand as any).plan ? 'default' : 'secondary'}>
                    {(activeBrand as any).plan?.toUpperCase() || 'AUCUN'}
                  </Badge>
                  <Badge variant={activeBrand.canva_connected ? 'default' : 'secondary'}>
                    {activeBrand.canva_connected ? '✓ Canva' : '○ Canva'}
                  </Badge>
                  {(activeBrand as any).is_addon && (
                    <Badge variant="outline" className="text-xs">
                      Add-on
                    </Badge>
                  )}
                </div>
              </div>
              <BrandDialog brand={activeBrand} onSuccess={loadBrands} />
            </div>

            {/* Palette */}
            {activeBrand.palette && activeBrand.palette.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Palette</label>
                <div className="flex gap-2 flex-wrap">
                  {activeBrand.palette.map((color: string, index: number) => (
                    <div
                      key={index}
                      className="w-10 h-10 rounded-lg border-2 border-border shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Voice */}
            {activeBrand.voice && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Ton de la marque</label>
                <p className="text-sm text-muted-foreground">{activeBrand.voice}</p>
              </div>
            )}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucune marque active. Crée ta première marque pour commencer.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
