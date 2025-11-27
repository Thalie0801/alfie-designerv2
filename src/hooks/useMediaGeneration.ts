import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface MediaGenerationRequest {
  userId: string;
  intent: {
    format: 'image' | 'carousel' | 'video';
    aspectRatio?: string;
    prompt?: string;
    count?: number;
    brandId?: string;
  };
}

// Result is tracked via orderId and status state

export function useMediaGeneration() {
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const { toast } = useToast();

  const generate = useCallback(async (request: MediaGenerationRequest): Promise<string | null> => {
    setLoading(true);
    setStatus('queued');

    try {
      const { data, error } = await supabase.functions.invoke('generate-media', {
        body: request
      });

      if (error) {
        console.error('Generation error:', error);
        toast({
          title: "Erreur de génération",
          description: error.message || "Une erreur est survenue",
          variant: "destructive"
        });
        setStatus('failed');
        return null;
      }

      if (!data?.ok || !data?.data?.orderId) {
        toast({
          title: "Erreur de génération",
          description: data?.message || "Erreur inconnue",
          variant: "destructive"
        });
        setStatus('failed');
        return null;
      }

      const newOrderId = data.data.orderId;
      setOrderId(newOrderId);
      setStatus('processing');

      toast({
        title: "Génération lancée",
        description: "Ton média est en cours de création...",
      });

      // Start polling for completion
      pollOrderStatus(newOrderId);

      return newOrderId;
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive"
      });
      setStatus('failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const pollOrderStatus = useCallback(async (orderIdToCheck: string) => {
    const maxAttempts = 60; // 5 minutes max (5s interval)
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const { data: order, error } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderIdToCheck)
          .single();

        if (error) {
          console.error('Error checking order status:', error);
          return;
        }

        setStatus(order.status);

        if (order.status === 'completed') {
          toast({
            title: "✅ Génération terminée !",
            description: "Ton média est prêt dans la bibliothèque",
          });
          return;
        }

        if (order.status === 'failed') {
          toast({
            title: "❌ Génération échouée",
            description: "Une erreur est survenue lors de la génération",
            variant: "destructive"
          });
          return;
        }

        // Continue polling if still processing
        attempts++;
        if (attempts < maxAttempts && (order.status === 'pending' || order.status === 'processing')) {
          setTimeout(checkStatus, 5000);
        } else if (attempts >= maxAttempts) {
          toast({
            title: "⏱️ Génération en cours",
            description: "La génération prend plus de temps que prévu. Vérifie la bibliothèque plus tard.",
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Start first check after 3 seconds
    setTimeout(checkStatus, 3000);
  }, [toast]);

  const cancel = useCallback(async () => {
    if (!orderId) return;

    try {
      const { error } = await supabase.functions.invoke('cancel-job-set', {
        body: { orderId }
      });

      if (error) {
        console.error('Cancel error:', error);
        toast({
          title: "Erreur",
          description: "Impossible d'annuler la génération",
          variant: "destructive"
        });
        return;
      }

      setStatus('cancelled');
      toast({
        title: "Annulé",
        description: "La génération a été annulée",
      });
    } catch (error) {
      console.error('Cancel error:', error);
    }
  }, [orderId, toast]);

  return {
    generate,
    cancel,
    loading,
    orderId,
    status
  };
}
