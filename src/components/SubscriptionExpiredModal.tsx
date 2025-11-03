import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface SubscriptionExpiredModalProps {
  open: boolean;
  onRenew: () => void;
}

export function SubscriptionExpiredModal({ open, onRenew }: SubscriptionExpiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <DialogTitle>Abonnement expiré</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>
              Votre abonnement a expiré et le renouvellement automatique n'a pas pu être effectué.
            </p>
            <p>
              Pour continuer à utiliser la plateforme, veuillez renouveler votre abonnement.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button onClick={onRenew} className="flex-1">
            Renouveler mon abonnement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
