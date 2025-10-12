import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PremiumConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  woofsRequired: number;
  woofsAvailable: number;
  onConfirm: () => void;
  brandName: string;
}

export function PremiumConfirmationModal({
  open,
  onOpenChange,
  woofsRequired,
  woofsAvailable,
  onConfirm,
  brandName,
}: PremiumConfirmationModalProps) {
  const canAfford = woofsAvailable >= woofsRequired;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🐾 Génération Premium T2V (Veo3)
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Cette vidéo haute qualité consomme <strong>{woofsRequired} Woofs</strong>.
            </p>
            <p className="text-sm">
              Budget actuel : <strong>{woofsAvailable} Woofs</strong> pour {brandName}
            </p>
          </DialogDescription>
        </DialogHeader>

        {!canAfford && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Budget insuffisant ! Ajoutez un Pack Woofs (+50 / +100) ou utilisez Sora (1 Woof).
            </AlertDescription>
          </Alert>
        )}

        {canAfford && (
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-semibold text-sm">Avantages Veo3 :</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Qualité cinématographique supérieure</li>
              <li>Mouvements fluides et naturels</li>
              <li>Meilleure cohérence temporelle</li>
              <li>Idéal pour contenus premium</li>
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={!canAfford}>
            Confirmer ({woofsRequired} Woofs)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
