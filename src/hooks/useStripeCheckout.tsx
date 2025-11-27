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
    brandName?: string,
    guestEmail?: string
  ) => {
    setLoading(true);
    try {
      const affiliateRef = getAffiliateRef();

      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || guestEmail;

      if (!email) {
        throw new Error("Email requis pour le checkout");
      }

      console.log("[useStripeCheckout] Creating checkout with email:", email);

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan,
          billing_period: billingPeriod,
          affiliate_ref: affiliateRef,
          brand_name: brandName,
          email: email
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors de la création du paiement');
      }

      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      if (data?.url) {
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
