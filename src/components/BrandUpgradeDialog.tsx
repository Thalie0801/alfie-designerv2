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
import { ArrowUpCircle, Check, Zap } from 'lucide-react';
import { BrandTier, useBrandManagement } from '@/hooks/useBrandManagement';
import { SYSTEM_CONFIG } from '@/config/systemConfig';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';

interface BrandUpgradeDialogProps {
  brandId: string;
  brandName: string;
  currentTier: BrandTier;
  onSuccess?: () => void;
}

export function BrandUpgradeDialog({ 
  brandId, 
  brandName, 
  currentTier, 
  onSuccess 
}: BrandUpgradeDialogProps) {
  const [open, setOpen] = useState(false);
  const { upgradeBrand, getUpgradeCost, loading } = useBrandManagement();
  const { loading: checkoutLoading } = useStripeCheckout();

  const tiers: { tier: BrandTier; name: string }[] = [
    { tier: 'starter', name: 'Starter' },
    { tier: 'pro', name: 'Pro' },
    { tier: 'studio', name: 'Studio' },
  ];

  const currentTierIndex = tiers.findIndex(t => t.tier === currentTier);

  const handleUpgrade = async (newTier: BrandTier) => {
    // TODO: Intégrer Stripe pour la facturation
    const success = await upgradeBrand(brandId, newTier);
    if (success) {
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUpCircle className="w-4 h-4 mr-2" />
          Upgrade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade {brandName}</DialogTitle>
          <DialogDescription>
            Augmente tes quotas en passant à un plan supérieur. Facturation au prorata.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier, index) => {
            const isCurrent = tier.tier === currentTier;
            const isAvailable = index > currentTierIndex;
            const quotas = SYSTEM_CONFIG.QUOTAS[tier.tier];
            const price = SYSTEM_CONFIG.PRICING[tier.tier.toUpperCase() as keyof typeof SYSTEM_CONFIG.PRICING];
            const upgradeCost = isCurrent ? 0 : getUpgradeCost(currentTier, tier.tier);

            return (
              <div
                key={tier.tier}
                className={`p-4 rounded-lg border-2 ${
                  isCurrent
                    ? 'border-primary bg-primary/5'
                    : isAvailable
                    ? 'border-border bg-background hover:border-primary/50'
                    : 'border-border bg-muted/50 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-lg">{tier.name}</h3>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Actuel
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{price}€<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
                    {isAvailable && upgradeCost > 0 && (
                      <p className="text-sm text-primary">+{upgradeCost}€ au prorata</p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span>{quotas.images} visuels/mois</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span>{quotas.videos} vidéos/mois</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>{quotas.woofs} Woofs/mois</span>
                    </div>
                  </div>

                  {isAvailable && (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(tier.tier)}
                      disabled={loading || checkoutLoading}
                    >
                      Upgrader
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
