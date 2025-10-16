import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getAuthHeader } from '@/lib/auth';

export function useCustomerPortal() {
  const [loading, setLoading] = useState(false);

  const openCustomerPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: {},
        headers: await getAuthHeader(),
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      toast.error(error.message || 'Erreur lors de l\'ouverture du portail');
    } finally {
      setLoading(false);
    }
  };

  return {
    openCustomerPortal,
    loading
  };
}
