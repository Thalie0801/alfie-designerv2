import { useEffect } from 'react';
import { useBrandManagement } from '@/hooks/useBrandManagement';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function BrandPaymentSuccess() {
  const { createAddonBrand } = useBrandManagement();

  useEffect(() => {
    const pendingPaidBrandName = localStorage.getItem('pending_paid_brand_name');
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    // Only proceed if returning from Stripe success page with a session
    if (!pendingPaidBrandName || payment !== 'success' || !sessionId) return;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId },
        });
        if (error) throw error;
        if (!data?.success) {
          return; // Do not create brand if payment not verified
        }
        const brand = await createAddonBrand({ name: pendingPaidBrandName });
        if (brand) {
          toast.success(`Marque "${pendingPaidBrandName}" créée avec succès !`);
          localStorage.removeItem('pending_paid_brand_name');
        }
      } catch (e: any) {
        console.error('Payment verification failed:', e);
      }
    })();
  }, [createAddonBrand]);

  return null; // Invisible component
}
