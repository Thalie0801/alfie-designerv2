import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandDialog } from './BrandDialog';
import { AddBrandDialog } from './AddBrandDialog';
import { Palette, AlertCircle, Edit, Plus, Link2, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

export function BrandManager() {
  const { 
    brands,
    activeBrand,
    activeBrandId,
    setActiveBrand,
    totalBrands, 
    quotaBrands, 
    canAddBrand,
    loadBrands,
    loading 
  } = useBrandKit();

  const handleBrandSwitch = async (brandId: string) => {
    try {
      await setActiveBrand(brandId);
      toast.success('Marque changée');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const totalAllowedBrands = quotaBrands ?? 0;
  const remainingBrandSlots = Math.max(0, totalAllowedBrands - totalBrands);
  const capacityLabel = totalAllowedBrands > 0
    ? (remainingBrandSlots > 0 ? `${remainingBrandSlots} slots restants` : 'Capacité atteinte')
    : 'Quota en cours';

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
    <Card className="border-primary/20 shadow-medium">
      <CardHeader className="bg-gradient-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Brand Kit actif</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono">
            {totalBrands}/{quotaBrands} marques
          </Badge>
        </div>
        <CardDescription>
          Bascule entre tes marques et gère leur identité visuelle
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        {/* Brand Switcher */}
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center justify-between">
            <span>Marque active</span>
            {canAddBrand && (
              <BrandDialog onSuccess={loadBrands}>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
                  <Plus className="h-3 w-3" />
                  Nouvelle
                </Button>
              </BrandDialog>
            )}
          </label>
          
          <Select value={activeBrandId || ''} onValueChange={handleBrandSwitch}>
            <SelectTrigger className="h-12 border-2">
              <SelectValue placeholder="Sélectionner une marque">
                {activeBrand && (
                  <div className="flex items-center gap-2">
                    {activeBrand.logo_url && (
                      <img
                        src={activeBrand.logo_url}
                        alt={activeBrand.name}
                        className="w-6 h-6 object-contain rounded"
                        loading="lazy"
                      />
                    )}
                    <span className="font-medium">{activeBrand.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  <div className="flex items-center gap-2">
                    {brand.logo_url && (
                      <img 
                        src={brand.logo_url} 
                        alt={brand.name}
                        className="w-5 h-5 object-contain rounded"
                      />
                    )}
                    <span>{brand.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Brand Preview */}
        {activeBrand ? (
          <div className="space-y-4 p-4 rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={activeBrand.canva_connected ? 'secondary' : 'outline'} className="gap-1">
                    <Link2 className="h-3.5 w-3.5" />
                    {activeBrand.canva_connected ? 'Canva connecté' : 'Canva non connecté'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {capacityLabel}
                  </Badge>
                </div>
                {/* Palette */}
                {activeBrand.palette && activeBrand.palette.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Couleurs
                    </label>
                    <div className="flex gap-1.5">
                      {activeBrand.palette.map((color, index) => (
                        <div
                          key={index}
                          className="w-10 h-10 rounded-md border-2 border-white shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Voice */}
                {activeBrand.voice && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Ton de la marque
                    </label>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {activeBrand.voice}
                    </p>
                  </div>
                )}
              </div>

              <BrandDialog brand={activeBrand} onSuccess={loadBrands}>
                <Button variant="outline" size="sm" className="gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
                  <Edit className="h-3.5 w-3.5" />
                  Modifier
                </Button>
              </BrandDialog>
            </div>
            <Button
              variant="secondary"
              disabled
              className="w-full justify-center gap-2 opacity-70 cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              Tester avec un template (bientôt)
            </Button>
          </div>
        ) : (
          <Alert className="border-primary/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucune marque active. Crée ta première marque pour commencer à personnaliser tes créations.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
