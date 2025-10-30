import { useEffect } from 'react';
import { useBrandManagement } from '@/hooks/useBrandManagement';
import { toast } from 'sonner';

export function BrandPaymentSuccess() {
  const { createAddonBrand } = useBrandManagement();

  useEffect(() => {
    // Check for paid brand creation
    const pendingPaidBrandName = localStorage.getItem('pending_paid_brand_name');
    
    if (pendingPaidBrandName) {
      // Create the paid brand after successful payment
      createAddonBrand({ name: pendingPaidBrandName }).then((brand) => {
        if (brand) {
          toast.success(`Marque "${pendingPaidBrandName}" créée avec succès !`);
          localStorage.removeItem('pending_paid_brand_name');
        }
      });
    }
  }, [createAddonBrand]);

  return null; // Invisible component
}
