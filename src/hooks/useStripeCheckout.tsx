import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
        // Open checkout in new tab if the browser environment exists
        if (typeof window !== 'undefined') {
          window.open(data.url, '_blank');
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error('Erreur lors de la création du paiement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return { createCheckout, loading };
}
