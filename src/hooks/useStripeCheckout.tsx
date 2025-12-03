import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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
      const { data: { user } } = await supabase.auth.getUser();
      
      // L'utilisateur DOIT être connecté
      if (!user?.email) {
        toast.error("Vous devez être connecté pour souscrire");
        window.location.href = '/auth';
        return;
      }

      console.log("[useStripeCheckout] Creating checkout:", { 
        email: user.email, 
        plan, 
        billingPeriod, 
        affiliateRef: affiliateRef || '(none)',
        brandName 
      });

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan,
          billing_period: billingPeriod,
          affiliate_ref: affiliateRef,
          brand_name: brandName,
          // Plus besoin d'envoyer l'email - le backend le récupère du JWT
        },
      });

      if (error) {
        throw new Error(error.message || 'Erreur lors de la création du paiement');
      }

      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      console.log("[useStripeCheckout] Checkout session created:", { url: data?.url ? 'received' : 'missing', affiliateRef });

      if (data?.url) {
        // Redirect to Stripe Checkout in the same window
        window.location.href = data.url;
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
