import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseSafeClient';
import { toast } from 'sonner';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  discount_percentage: number | null;
  stripe_price_id: string;
}

export function useCreditPacks() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_packs')
        .select('*')
        .order('credits', { ascending: true });

      if (error) throw error;
      setPacks(data || []);
    } catch (error) {
      console.error('Error fetching packs:', error);
      toast.error('Erreur lors du chargement des packs');
    }
  };

  const purchasePack = async (packId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-credit-pack', {
        body: { pack_id: packId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error('Erreur lors de l\'achat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return { packs, loading, purchasePack };
}
