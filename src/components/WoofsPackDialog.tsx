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
import { Zap, Sparkles } from 'lucide-react';
import { useWoofsPack, WOOFS_PACKS } from '@/hooks/useWoofsPack';

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
  const { purchaseWoofsPack, loading } = useWoofsPack();

  const handlePurchase = async (packSize: 50 | 100 | 250 | 500) => {
    const success = await purchaseWoofsPack(brandId, packSize);
    if (success) {
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm" className="gap-2">
            <Zap className="w-4 h-4" />
            Acheter des Woofs
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Acheter un Pack Woofs
          </DialogTitle>
          <DialogDescription>
            Augmente ton quota de Woofs pour continuer à créer du contenu sur <strong>{brandName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
          {WOOFS_PACKS.map((pack) => (
            <div
              key={pack.size}
              className="relative flex flex-col p-4 rounded-lg border-2 hover:border-primary/50 transition-all hover:shadow-md"
            >
              {pack.size === 250 && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                  Populaire
                </div>
              )}
              {pack.bonus && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  +{pack.bonus} GRATUITS
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-bold text-xl">+{pack.size} Woofs</span>
                {pack.bonus && (
                  <span className="text-green-500 font-bold text-sm">+{pack.bonus}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3 flex-grow">
                {pack.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-2xl">{pack.price}€</span>
                <Button
                  onClick={() => handlePurchase(pack.size)}
                  disabled={loading}
                  size="sm"
                >
                  {loading ? 'Chargement...' : 'Acheter'}
                </Button>
              </div>
              {pack.size > 50 && (
                <p className="text-xs text-primary mt-2 font-medium">
                  Économie par rapport au pack de 50
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-primary/5 text-sm">
          <p className="font-medium mb-1 flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            Comment ça marche ?
          </p>
          <ul className="text-muted-foreground space-y-1 ml-5 list-disc">
            <li>Les Woofs sont ajoutés immédiatement à ton quota mensuel</li>
            <li>1 Woof = 1 image ou 1 slide de carrousel</li>
            <li>25 Woofs = 1 vidéo premium (6s)</li>
            <li>Valables uniquement pour la marque <strong>{brandName}</strong></li>
          </ul>
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
