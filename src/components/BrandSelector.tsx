import { Check, ChevronDown, Plus, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandDialog } from '@/components/BrandDialog';
import { toast } from 'sonner';
import { safeNumber } from '@/lib/safeRender';

export function BrandSelector() {
  const { 
    brands, 
    activeBrandId, 
    setActiveBrand, 
    totalBrands, 
    quotaBrands,
    canAddBrand,
    loadBrands 
  } = useBrandKit();

  const activeBrand = brands.find(b => b.id === activeBrandId);

  const handleBrandChange = async (brandId: string) => {
    try {
      await setActiveBrand(brandId);
      toast.success('Marque active changée');
    } catch (error) {
      toast.error('Erreur lors du changement de marque');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="truncate">
                {activeBrand?.name || 'Sélectionner une marque'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[250px] bg-background border-2 z-50">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Mes marques</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {safeNumber(totalBrands, 0)}/{safeNumber(quotaBrands, 1)}
              </Badge>
              {totalBrands >= quotaBrands && (
                <Badge variant="destructive" className="text-xs">
                  Quota atteint
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {brands.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucune marque créée
            </div>
          ) : (
            brands.map((brand) => (
              <DropdownMenuItem
                key={brand.id}
                onClick={() => handleBrandChange(brand.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {brand.logo_url && (
                  <img 
                    src={brand.logo_url} 
                    alt={brand.name}
                    className="w-5 h-5 object-contain rounded"
                  />
                )}
                <span className="flex-1 truncate">{brand.name}</span>
                {brand.id === activeBrandId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))
          )}
          
          <DropdownMenuSeparator />
          
          {canAddBrand ? (
            <BrandDialog onSuccess={loadBrands}>
              <DropdownMenuItem 
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer text-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer une marque gratuite ({safeNumber(quotaBrands, 1) - safeNumber(totalBrands, 0)} restante)
              </DropdownMenuItem>
            </BrandDialog>
          ) : (
            <DropdownMenuItem disabled className="text-muted-foreground text-xs italic px-3 py-2">
              <div className="space-y-1">
                <div className="font-medium">✋ Limite atteinte ({totalBrands}/{quotaBrands})</div>
                <div className="text-xs">Utilisez "Ajouter une marque + 39€" ci-dessous pour une marque payante</div>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
