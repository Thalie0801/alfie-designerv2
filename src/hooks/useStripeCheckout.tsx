import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAffiliate } from './useAffiliate';
import {
  sanitizePaymentMetadata,
  type PaymentMetadataInput,
  type PaymentMetadata
} from '@/lib/payment-metadata';

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const { getAffiliateRef } = useAffiliate();

  const createCheckout = async (
    plan: 'starter' | 'pro' | 'studio' | 'enterprise',
    billingPeriod: 'monthly' | 'annual' = 'monthly',
    brandName?: string,
    paymentMetadata?: PaymentMetadataInput
  ) => {
    setLoading(true);
    try {
      const affiliateRef = getAffiliateRef();

      let sanitizedMetadata: PaymentMetadata | undefined;
      if (paymentMetadata) {
        try {
          sanitizedMetadata = sanitizePaymentMetadata(paymentMetadata);
        } catch (error) {
          console.error('Invalid payment metadata supplied:', error);
          toast.error('Métadonnées de paiement invalides');
          setLoading(false);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        plan,
        billing_period: billingPeriod,
        affiliate_ref: affiliateRef,
        brand_name: brandName?.trim(),
      };

      if (sanitizedMetadata) {
        payload.payment_metadata = sanitizedMetadata;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: payload,
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
