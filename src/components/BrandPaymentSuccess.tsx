import { useEffect } from 'react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { toast } from 'sonner';

export function BrandPaymentSuccess() {
  const { loadBrands } = useBrandKit();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    // Only proceed if returning from Stripe success page
    if (payment !== 'success' || !sessionId) return;

    // Brand creation is handled by verify-payment edge function
    // Just reload brands and show success message
    (async () => {
      try {
        // Wait a bit for the edge function to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadBrands();
        toast.success('Marque créée avec succès !');
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e: any) {
        console.error('Error reloading brands:', e);
      }
    })();
  }, [loadBrands]);

  return null; // Invisible component
}
