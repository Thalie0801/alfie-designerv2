import { useState } from 'react';
// Lazy import to avoid env crash at startup
let _supabase: any | null = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const mod = await import('@/integrations/supabase/client');
  _supabase = mod.supabase;
  return _supabase;
}
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

      const sb = await getSupabase();

      const { data, error } = await sb.functions.invoke('create-checkout', {
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
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error('Erreur lors de la création du paiement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return { createCheckout, loading };
}
