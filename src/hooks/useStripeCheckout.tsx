import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useAffiliate } from './useAffiliate';
import { getAuthHeader } from '@/lib/auth';

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const { getAffiliateRef } = useAffiliate();

  const createCheckout = async (
    plan: 'starter' | 'pro' | 'studio' | 'enterprise',
    billingPeriod: 'monthly' | 'annual' = 'monthly'
  ) => {
    setLoading(true);
    try {
      const affiliateRef = getAffiliateRef();
      
      const headers = session
        ? { Authorization: `Bearer ${session.access_token}` }
        : await getAuthHeader();

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan,
          billing_period: billingPeriod,
          affiliate_ref: affiliateRef
        },
        headers,
      });

      if (error) throw error;

      if (data?.url) {
        // Open checkout in new tab
        window.open(data.url, '_blank');
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
