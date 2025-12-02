import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAffiliate } from '@/hooks/useAffiliate';

export type WoofsPackSize = 50 | 100 | 250 | 500;

interface WoofsPack {
  size: WoofsPackSize;
  price: number;
  stripePriceId: string;
  description: string;
}

export const WOOFS_PACKS: WoofsPack[] = [
  {
    size: 50,
    price: 9,
    stripePriceId: 'price_woofs_pack_50',
    description: 'Pack Starter - 50 Woofs',
  },
  {
    size: 100,
    price: 16,
    stripePriceId: 'price_woofs_pack_100',
    description: 'Pack Pro - 100 Woofs (-11%)',
  },
  {
    size: 250,
    price: 35,
    stripePriceId: 'price_woofs_pack_250',
    description: 'Pack Studio - 250 Woofs (-22%)',
  },
  {
    size: 500,
    price: 60,
    stripePriceId: 'price_woofs_pack_500',
    description: 'Pack Enterprise - 500 Woofs (-33%)',
  },
];

export function useWoofsPack() {
  const { user } = useAuth();
  const { getAffiliateRef } = useAffiliate();
  const [loading, setLoading] = useState(false);

  /**
   * Acheter un pack de Woofs via Stripe
   */
  const purchaseWoofsPack = async (brandId: string, packSize: WoofsPackSize) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return false;
    }

    const pack = WOOFS_PACKS.find(p => p.size === packSize);
    if (!pack) {
      toast.error('Pack invalide');
      return false;
    }

    setLoading(true);
    try {
      // Récupérer la référence affilié si présente
      const affiliateRef = getAffiliateRef();

      // Créer une session Stripe checkout pour achat one-off
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          mode: 'payment', // One-off payment, not subscription
          price_id: pack.stripePriceId,
          purchase_type: 'woofs_pack',
          affiliate_ref: affiliateRef || undefined,
          metadata: {
            brand_id: brandId,
            woofs_pack_size: packSize.toString(),
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Rediriger vers Stripe Checkout
        window.location.href = data.url;
        return true;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error('Erreur lors de la création du paiement: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    purchaseWoofsPack,
    loading,
    availablePacks: WOOFS_PACKS,
  };
}
