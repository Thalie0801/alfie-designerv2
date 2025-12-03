import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

// Types pour les erreurs de génération vidéo
interface VideoGenerationError {
  error?: string;
  message?: string;
  suggestions?: string[];
  details?: string;
}

/**
 * Gère l'affichage des erreurs de génération vidéo avec messages améliorés
 */
export function handleVideoGenerationError(error: VideoGenerationError) {
  const errorCode = error?.error;
  
  // Erreur de politique de contenu (marques, personnes réelles)
  if (errorCode === "CONTENT_POLICY_VIOLATION") {
    toast({
      title: "⚠️ Contenu non autorisé",
      description: error.message || "Ton prompt contient des éléments non autorisés. Reformule avec des descriptions génériques.",
      variant: "destructive",
    });
    
    // Afficher les suggestions si disponibles
    if (error.suggestions?.length) {
      setTimeout(() => {
        toast({
          title: "💡 Conseils",
          description: error.suggestions!.slice(0, 2).join(" • "),
        });
      }, 1000);
    }
    return true;
  }
  
  // Woofs insuffisants
  if (errorCode === "INSUFFICIENT_WOOFS") {
    toast({
      title: "🐕 Woofs insuffisants",
      description: error.message || "Tu n'as plus assez de Woofs pour cette génération.",
      variant: "destructive",
    });
    return true;
  }
  
  return false;
}

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
          .select('id, status, metadata')
          .in('id', orderIds);

        if (error) {
          console.error('Erreur polling orders:', error);
          return;
        }

        if (!orders?.length) return;

        const completed = orders.filter(o => o.status === 'completed').length;
        const failed = orders.filter(o => o.status === 'failed').length;
        const total = orders.length;

        // Vérifier les erreurs spécifiques dans les metadata des orders failed
        const failedOrders = orders.filter(o => o.status === 'failed');
        for (const failedOrder of failedOrders) {
          const metadata = failedOrder.metadata as VideoGenerationError | null;
          if (metadata && handleVideoGenerationError(metadata)) {
            // L'erreur a été gérée avec un message spécifique
            continue;
          }
        }

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
            // ❌ Échec total - afficher uniquement si pas déjà géré par handleVideoGenerationError
            const hasSpecificError = failedOrders.some(o => {
              const meta = o.metadata as VideoGenerationError | null;
              return meta?.error === "CONTENT_POLICY_VIOLATION" || meta?.error === "INSUFFICIENT_WOOFS";
            });
            
            if (!hasSpecificError) {
              toast({
                title: "❌ La génération a échoué",
                description: "Réessaie ou contacte le support.",
                variant: "destructive",
              });
            }
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

  return { trackOrders, stopPolling, handleVideoGenerationError };
}
