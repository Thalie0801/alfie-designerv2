import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { useBrandManagement } from '@/hooks/useBrandManagement';
import { SYSTEM_CONFIG } from '@/config/systemConfig';

interface WoofsPackDialogProps {
  brandId: string;
  brandName: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function WoofsPackDialog({ 
  brandId, 
  brandName, 
  onSuccess,
  trigger 
}: WoofsPackDialogProps) {
  const [open, setOpen] = useState(false);
  const { addWoofsPack, loading } = useBrandManagement();

  const handleAddPack = async (packSize: 50 | 100) => {
    const success = await addWoofsPack(brandId, packSize);
    if (success) {
      setOpen(false);
      onSuccess?.();
    }
  };

  const packSizes = SYSTEM_CONFIG.PACK_WOOFS_SIZES as [50, 100];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Zap className="w-4 h-4 mr-2" />
            Pack Woofs
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un Pack Woofs</DialogTitle>
          <DialogDescription>
            Augmente tes Woofs pour générer plus de vidéos sur {brandName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {packSizes.map((size) => (
            <div
              key={size}
              className="flex items-center justify-between p-4 rounded-lg border-2 hover:border-primary/50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-lg">+{size} Woofs</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {size === 50 ? 'Pack Standard' : 'Pack Pro'}
                </p>
              </div>
              <Button
                onClick={() => handleAddPack(size)}
                disabled={loading}
              >
                {loading ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-primary/5 text-sm">
          <p className="font-medium mb-1">💡 Rappel</p>
          <p className="text-muted-foreground">
            Veo 3 consomme 4 Woofs par vidéo, Sora en consomme 1.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
