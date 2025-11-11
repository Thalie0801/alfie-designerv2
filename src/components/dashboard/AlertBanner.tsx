import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Info, Palette } from 'lucide-react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useActivityStats } from '@/hooks/useActivityStats';
import { BrandDialog } from '@/components/BrandDialog';
import { BrandUpgradeDialog } from '@/components/BrandUpgradeDialog';
import { BrandTier } from '@/hooks/useBrandManagement';
import { useState } from 'react';

export function AlertBanner() {
  const { activeBrand, activeBrandId } = useBrandKit();
  const { stats } = useActivityStats(activeBrandId);
  const [showBrandDialog, setShowBrandDialog] = useState(false);

  if (!activeBrand || !stats) return null;

  // Vérifier quota critique
  const visualsPercentage = stats.imagesQuota > 0 ? (stats.imagesCount / stats.imagesQuota) * 100 : 0;
  const videosPercentage = stats.videosQuota > 0 ? (stats.videosCount / stats.videosQuota) * 100 : 0;
  
  if (visualsPercentage >= 90 || videosPercentage >= 90) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
          <span>⚠️ Plus que 10% de tes quotas disponibles ce mois !</span>
          <BrandUpgradeDialog
            brandId={activeBrand.id}
            brandName={activeBrand.name}
            currentTier={(activeBrand as any).plan as BrandTier || 'starter'}
          />
        </AlertDescription>
      </Alert>
    );
  }

  // Vérifier Brand Kit incomplet
  const hasPalette = activeBrand.palette && activeBrand.palette.length > 0;
  const hasVoice = Boolean(activeBrand.voice);
  
  if (!hasPalette || !hasVoice) {
    return (
      <>
        <Alert className="mb-4 border-primary/50 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
            <span>💡 Complète ton Brand Kit pour des générations plus personnalisées</span>
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
          <BrandDialog 
            brand={activeBrand} 
            onSuccess={() => setShowBrandDialog(false)}
          />
        )}
      </>
    );
  }

  // Vérifier Canva non connecté
  if (!activeBrand.canva_connected) {
    return (
      <Alert className="mb-4 border-accent/50 bg-accent/5">
        <Info className="h-4 w-4 text-accent-foreground" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
          <span>🎨 Connecte Canva pour exporter directement tes créations</span>
          <Button variant="outline" size="sm">
            Connecter Canva
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
