import { useEffect } from 'react';
import { useBrandManagement } from '@/hooks/useBrandManagement';
import { toast } from 'sonner';

export function BrandPaymentSuccess() {
  const { createAddonBrand } = useBrandManagement();

  useEffect(() => {
    const pendingBrandName = localStorage.getItem('pending_brand_name');
    
    if (pendingBrandName) {
      // Create the brand after successful payment
      createAddonBrand({ name: pendingBrandName }).then((brand) => {
        if (brand) {
          toast.success(`Marque "${pendingBrandName}" créée avec succès !`);
          localStorage.removeItem('pending_brand_name');
        }
      });
    }
  }, [createAddonBrand]);

  return null; // Invisible component
}
