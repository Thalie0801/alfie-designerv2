import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

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
      // Créer une session Stripe checkout pour achat one-off
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: pack.stripePriceId,
          mode: 'payment', // One-off payment, not subscription
          metadata: {
            brand_id: brandId,
            woofs_pack_size: packSize.toString(),
            purchase_type: 'woofs_pack',
          },
          successUrl: `${window.location.origin}/dashboard?woofs_pack_success=true`,
          cancelUrl: `${window.location.origin}/dashboard?woofs_pack_cancelled=true`,
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

  /**
   * Ajouter les Woofs après paiement réussi (appelé par webhook Stripe)
   * Cette fonction sera appelée par l'Edge Function après vérification du paiement
   */
  const addWoofsToQuota = async (brandId: string, woofsAmount: number) => {
    try {
      // Incrémenter le quota_woofs de la marque (quota total)
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('quota_woofs')
        .eq('id', brandId)
        .single();

      if (brandError) throw brandError;

      const newQuota = (brand.quota_woofs || 0) + woofsAmount;

      const { error: updateError } = await supabase
        .from('brands')
        .update({ quota_woofs: newQuota })
        .eq('id', brandId);

      if (updateError) throw updateError;

      return true;
    } catch (error: any) {
      console.error('Error adding Woofs to quota:', error);
      return false;
    }
  };

  return {
    purchaseWoofsPack,
    addWoofsToQuota,
    loading,
    availablePacks: WOOFS_PACKS,
  };
}
