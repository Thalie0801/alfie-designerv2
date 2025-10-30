import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CreditCard } from 'lucide-react';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { SYSTEM_CONFIG } from '@/config/systemConfig';

interface BrandUpgradePaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBrandsCount: number;
}

export function BrandUpgradePayment({ 
  open, 
  onOpenChange,
  currentBrandsCount 
}: BrandUpgradePaymentProps) {
  const { createCheckout, loading } = useStripeCheckout();

  const handlePayment = async () => {
    // Create checkout for starter plan (39€/month for additional brand)
    await createCheckout('starter', 'monthly');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Limite de marques atteinte
          </DialogTitle>
          <DialogDescription>
            Vous avez atteint la limite de {currentBrandsCount} marques. Pour ajouter une marque supplémentaire, 
            vous devez souscrire à un abonnement Starter additionnel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-gradient-hero text-white space-y-3">
            <h4 className="font-semibold text-lg">Abonnement Marque Supplémentaire</h4>
            <div className="text-3xl font-bold">
              {SYSTEM_CONFIG.PRICING.ADDON_BRAND}€<span className="text-sm font-normal">/mois</span>
            </div>
            <p className="text-sm opacity-90">
              Chaque marque supplémentaire bénéficie de son propre plan Starter
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted space-y-2">
            <p className="font-medium text-sm">Quotas Starter inclus par marque :</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{SYSTEM_CONFIG.QUOTAS.starter.images} visuels/mois</li>
              <li>{SYSTEM_CONFIG.QUOTAS.starter.videos} vidéos/mois</li>
              <li>{SYSTEM_CONFIG.QUOTAS.starter.woofs} Woofs/mois</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg border border-border space-y-2">
            <p className="font-medium text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Avantages
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Quotas dédiés pour chaque marque</li>
              <li>✓ Gestion simplifiée de plusieurs clients</li>
              <li>✓ Pas besoin de changer de compte</li>
              <li>✓ Facturation centralisée</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button 
            onClick={handlePayment}
            disabled={loading}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" />
            {loading ? 'Redirection...' : 'Payer 39€/mois'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
