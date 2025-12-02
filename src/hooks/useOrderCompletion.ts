import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

export function useOrderCompletion() {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const trackOrders = useCallback((orderIds: string[]) => {
    if (!orderIds.length) return;

    const startTime = Date.now();
    const maxDuration = 5 * 60 * 1000; // 5 minutes max
    const pollInterval = 5000; // 5 secondes

    const checkStatus = async () => {
      // Timeout de sécurité
      if (Date.now() - startTime > maxDuration) {
        stopPolling();
        toast({
          title: "⏱️ Génération en cours",
          description: "La génération prend plus de temps que prévu. Vérifie la bibliothèque.",
        });
        return;
      }

      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, status')
          .in('id', orderIds);

        if (error) {
          console.error('Erreur polling orders:', error);
          return;
        }

        if (!orders?.length) return;

        const completed = orders.filter(o => o.status === 'completed').length;
        const failed = orders.filter(o => o.status === 'failed').length;
        const total = orders.length;

        // Tous terminés (succès ou échec)
        if (completed + failed === total) {
          stopPolling();

          if (failed === 0) {
            // ✅ Succès total
            toast({
              title: "✅ Génération terminée !",
              description: "Retrouve tes visuels dans la bibliothèque 🎨",
            });
          } else if (completed > 0) {
            // ⚠️ Succès partiel
            toast({
              title: "⚠️ Génération partiellement terminée",
              description: `${completed}/${total} visuels générés. Certains ont échoué.`,
              variant: "destructive",
            });
          } else {
            // ❌ Échec total
            toast({
              title: "❌ La génération a échoué",
              description: "Réessaie ou contacte le support.",
              variant: "destructive",
            });
          }
        }
      } catch (err) {
        console.error('Erreur lors du polling:', err);
      }
    };

    // Démarrer le polling
    stopPolling(); // Arrêter tout polling existant
    pollingRef.current = setInterval(checkStatus, pollInterval);

    // Premier check après 3 secondes
    setTimeout(checkStatus, 3000);
  }, [stopPolling]);

  return { trackOrders, stopPolling };
}
