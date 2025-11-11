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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard } from 'lucide-react';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { SYSTEM_CONFIG } from '@/config/systemConfig';
import { useAuth } from '@/hooks/useAuth';

export function AddPaidBrandDialog() {
  const [open, setOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const { createCheckout, loading } = useStripeCheckout();
  const { user } = useAuth();

  const handlePayment = async () => {
    const normalizedBrandName = brandName.trim();
    if (!normalizedBrandName) return;

    const metadata = user?.email
      ? {
          amount: SYSTEM_CONFIG.PRICING.ADDON_BRAND,
          currency: 'EUR' as const,
          description: normalizedBrandName,
          reference: 'ADDON-BRAND',
          customerEmail: user.email,
        }
      : undefined;

    // Create Stripe checkout with brand name in metadata
    await createCheckout('starter', 'monthly', normalizedBrandName, metadata);

    setOpen(false);
    setBrandName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full">
          <CreditCard className="w-4 h-4 mr-2" />
          Ajouter une marque + 39€
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une marque (Starter)</DialogTitle>
          <DialogDescription>
            Créez une nouvelle marque avec un abonnement Starter à {SYSTEM_CONFIG.PRICING.ADDON_BRAND}€/mois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paid-brand-name">Nom de la marque</Label>
            <Input
              id="paid-brand-name"
              placeholder="Ex: Ma nouvelle marque"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePayment();
                }
              }}
            />
          </div>

          <div className="p-4 rounded-lg bg-gradient-hero text-white space-y-3">
            <h4 className="font-semibold text-lg">Plan Starter</h4>
            <div className="text-3xl font-bold">
              {SYSTEM_CONFIG.PRICING.ADDON_BRAND}€<span className="text-sm font-normal">/mois</span>
            </div>
            <p className="text-sm opacity-90">
              Quotas dédiés pour cette marque
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
            <p className="font-medium">Quotas Starter inclus :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{SYSTEM_CONFIG.QUOTAS.starter.images} visuels/mois</li>
              <li>{SYSTEM_CONFIG.QUOTAS.starter.videos} vidéos/mois</li>
              <li>{SYSTEM_CONFIG.QUOTAS.starter.woofs} Woofs/mois</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handlePayment}
            disabled={loading || !brandName.trim()}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" />
            {loading ? 'Redirection...' : `Payer ${SYSTEM_CONFIG.PRICING.ADDON_BRAND}€/mois`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
