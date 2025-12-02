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
import { ArrowUpCircle, Zap } from 'lucide-react';
import { BrandTier } from '@/hooks/useBrandManagement';
import { SYSTEM_CONFIG } from '@/config/systemConfig';
import { supabase } from '@/lib/supabase';
import { useAffiliate } from '@/hooks/useAffiliate';
import { toast } from 'sonner';

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
  onSuccess: _onSuccess 
}: BrandUpgradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { getAffiliateRef } = useAffiliate();

  // Note: onSuccess is available for future use when implementing post-upgrade actions

  const tiers: { tier: BrandTier; name: string }[] = [
    { tier: 'starter', name: 'Starter' },
    { tier: 'pro', name: 'Pro' },
    { tier: 'studio', name: 'Studio' },
  ];

  const currentTierIndex = tiers.findIndex(t => t.tier === currentTier);

  const getUpgradeCost = (from: BrandTier, to: BrandTier): number => {
    const prices = SYSTEM_CONFIG.PRICING;
    const fromPrice = prices[from.toUpperCase() as keyof typeof prices] || 0;
    const toPrice = prices[to.toUpperCase() as keyof typeof prices] || 0;
    return Math.max(0, toPrice - fromPrice);
  };

  const handleUpgrade = async (newTier: BrandTier) => {
    setLoading(true);
    try {
      const affiliateRef = getAffiliateRef();
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          mode: 'subscription',
          plan: newTier,
          billing_period: 'monthly',
          affiliate_ref: affiliateRef || undefined,
          metadata: {
            upgrade_from: currentTier,
            brand_id: brandId,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors de la création du paiement');
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast.error('Erreur lors de l\'upgrade: ' + error.message);
    } finally {
      setLoading(false);
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
                      <Zap className="w-4 h-4 text-primary" />
                      <span>{quotas.woofs} Woofs/mois</span>
                    </div>
                  </div>

                  {isAvailable && (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(tier.tier)}
                      disabled={loading}
                    >
                      {loading ? 'Redirection...' : 'Upgrader'}
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
