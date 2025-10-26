import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Palette, AlertCircle, Zap, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BrandSelector } from '@/components/BrandSelector';
import { BrandDialog } from '@/components/BrandDialog';
import { BrandUpgradeDialog } from '@/components/BrandUpgradeDialog';
import { WoofsPackDialog } from '@/components/WoofsPackDialog';
import { BrandTier } from '@/hooks/useBrandManagement';
import { useState, useEffect } from 'react';
import { getQuotaStatus, QuotaStatus } from '@/utils/quotaManager';

export function ActiveBrandCard() {
  const { activeBrand, activeBrandId, totalBrands, quotaBrands, loadBrands } = useBrandKit();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotas();
  }, [activeBrandId]);

  const loadQuotas = async () => {
    if (!activeBrandId) {
      setLoading(false);
      return;
    }

    const status = await getQuotaStatus(activeBrandId);
    setQuotaStatus(status);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  const showUpgradeOptions = quotaStatus && (
    quotaStatus.visuals.percentage >= 80 || 
    quotaStatus.videos.percentage >= 80 || 
    (quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100 >= 80
  );

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

            {/* Quotas */}
            {quotaStatus && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Quotas du mois
                  </h4>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Reset le {new Date(quotaStatus.resetsOn || '').toLocaleDateString('fr-FR')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Barres de progression */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Visuels</span>
                      <span className="text-muted-foreground">
                        {quotaStatus.visuals.used} / {quotaStatus.visuals.limit}
                      </span>
                    </div>
                    <Progress value={Math.min(quotaStatus.visuals.percentage, 100)} className="h-2" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Vidéos</span>
                      <span className="text-muted-foreground">
                        {quotaStatus.videos.used} / {quotaStatus.videos.limit}
                      </span>
                    </div>
                    <Progress value={Math.min(quotaStatus.videos.percentage, 100)} className="h-2" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Woofs</span>
                      <span className="text-muted-foreground">
                        {quotaStatus.woofs.consumed} / {quotaStatus.woofs.limit}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min((quotaStatus.woofs.consumed / quotaStatus.woofs.limit) * 100, 100)} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions upgrade */}
            {showUpgradeOptions && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  💡 Approche de la limite ? Plusieurs options :
                </p>
                <div className="flex gap-2 flex-wrap">
                  <BrandUpgradeDialog
                    brandId={activeBrand.id}
                    brandName={activeBrand.name}
                    currentTier={(activeBrand as any).plan as BrandTier || 'starter'}
                    onSuccess={loadQuotas}
                  />
                  <WoofsPackDialog
                    brandId={activeBrand.id}
                    brandName={activeBrand.name}
                    onSuccess={loadQuotas}
                  />
                </div>
              </div>
            )}

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
