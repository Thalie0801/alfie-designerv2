import { useState } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { toast } from 'sonner';
import { useAffiliate } from './useAffiliate';

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const { getAffiliateRef } = useAffiliate();

  const createCheckout = async (
    plan: 'starter' | 'pro' | 'studio' | 'enterprise',
    billingPeriod: 'monthly' | 'annual' = 'monthly',
    brandName?: string
  ) => {
    setLoading(true);
    try {
      const affiliateRef = getAffiliateRef();

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan,
          billing_period: billingPeriod,
          affiliate_ref: affiliateRef,
          brand_name: brandName
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open checkout in new tab
        window.open(data.url, '_blank');
      }
    } catch (error: unknown) {
      console.error('Checkout error:', error);
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur lors de la création du paiement: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return { createCheckout, loading };
}
