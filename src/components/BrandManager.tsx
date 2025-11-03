import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandSelector } from './BrandSelector';
import { BrandDialog } from './BrandDialog';
import { Palette, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export function BrandManager() {
  const { 
    activeBrand, 
    totalBrands, 
    quotaBrands,
    loadBrands,
    loading 
  } = useBrandKit();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Brand Kit</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono">
            {totalBrands}/{quotaBrands}
          </Badge>
        </div>
        <CardDescription>
          Sélectionne ou gère tes marques pour personnaliser tes designs
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Brand Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Marque active</label>
          <BrandSelector />
        </div>

        {/* Active Brand Details */}
        {activeBrand && (
          <div className="space-y-4 p-4 rounded-lg border-2 bg-muted/30">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {activeBrand.logo_url && (
                    <img 
                      src={activeBrand.logo_url} 
                      alt={activeBrand.name}
                      className="w-8 h-8 object-contain rounded border"
                    />
                  )}
                  <h3 className="font-semibold">{activeBrand.name}</h3>
                </div>
                <div className="flex gap-2">
                  <Badge variant={(activeBrand as any).plan ? "default" : "secondary"}>
                    {(activeBrand as any).plan?.toUpperCase() || 'AUCUN'}
                  </Badge>
                  <Badge variant={activeBrand.canva_connected ? "default" : "secondary"}>
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
                <label className="text-sm font-medium">Palette de couleurs</label>
                <div className="flex gap-2 flex-wrap">
                  {activeBrand.palette.map((color: any, index: number) => {
                    const rawColor = typeof color === 'string' ? color : (color?.color || '#000000');
                    const hexColor = rawColor.replace(/["'\\]/g, "");
                    return (
                      <div
                        key={index}
                        className="w-12 h-12 rounded-lg border-2 border-border shadow-sm"
                        style={{ backgroundColor: hexColor }}
                        title={hexColor}
                      />
                    );
                  })}
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
        )}

        {!activeBrand && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucune marque active. Crée ta première marque pour commencer.
            </AlertDescription>
          </Alert>
        )}

        {/* Add Brand Section - Hidden since only 1 brand allowed */}
        {totalBrands === 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Créer votre marque</label>
              <p className="text-xs text-muted-foreground">
                Vous avez droit à 1 marque incluse dans votre compte
              </p>
              <BrandDialog onSuccess={loadBrands} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
