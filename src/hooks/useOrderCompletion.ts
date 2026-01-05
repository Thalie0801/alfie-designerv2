import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

// Types pour les erreurs de génération vidéo
interface VideoGenerationError {
  error?: string;
  message?: string;
  suggestions?: string[];
  details?: string;
  detectedNames?: string[];
}

/**
 * Gère l'affichage des erreurs de génération vidéo avec messages améliorés
 */
export function handleVideoGenerationError(error: VideoGenerationError) {
  const errorCode = error?.error;
  const errorMessage = error?.message || "";
  const errorDetails = error?.details || "";
  
  // Erreur de politique de contenu (célébrités interdites)
  if (errorCode === "CONTENT_POLICY_VIOLATION") {
    const celebNames = error.detectedNames?.slice(0, 3).join(", ");
    const description = celebNames 
      ? `Célébrités non autorisées : ${celebNames}. Utilise des descriptions génériques à la place.`
      : error.message || "Contenu non autorisé détecté.";
    
    toast({
      title: "⚠️ Célébrités non autorisées",
      description,
      variant: "destructive",
    });
    
    // Message positif sur ce qui est possible
    setTimeout(() => {
      toast({
        title: "💡 Ce qui fonctionne",
        description: "Descriptions génériques OK ('une femme dynamique'). Photos = inspiration de style, pas reproduction du visage.",
      });
    }, 1500);
    return true;
  }
  
  // Pas de vidéo retournée par VEO 3
  if (errorCode === "NO_VIDEO_URI" || errorMessage.includes("No video URI") || errorDetails.includes("No video URI")) {
    toast({
      title: "❌ Génération échouée",
      description: "VEO 3 n'a pas pu créer la vidéo. Vérifie que ton prompt ne mentionne pas de célébrités.",
      variant: "destructive",
    });
    
    setTimeout(() => {
      toast({
        title: "💡 Rappel",
        description: "✅ Personnes génériques OK • ✅ Photos = inspiration de style • ❌ Célébrités interdites",
      });
    }, 1500);
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

interface TrackOrdersOptions {
  isVideo?: boolean;
  onComplete?: (completedCount: number, failedCount: number) => void;
}

export function useOrderCompletion() {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const trackOrders = useCallback((orderIds: string[], options?: TrackOrdersOptions) => {
    if (!orderIds.length) return;

    const { isVideo = false, onComplete } = options || {};
    const startTime = Date.now();
    // ✅ Timeout étendu pour les vidéos (15 min) vs images (5 min)
    const maxDuration = isVideo ? 15 * 60 * 1000 : 5 * 60 * 1000;
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
        // ✅ CHANGED: Poll job_queue instead of orders for accurate completion status
        // This ensures we wait for all job_steps to complete before showing toast
        const { data: jobs, error: jobError } = await supabase
          .from('job_queue')
          .select('id, status, error, order_id, finished_at')
          .in('order_id', orderIds);

        if (jobError) {
          console.error('Erreur polling job_queue:', jobError);
          return;
        }

        // If jobs found, use job_queue status (preferred method)
        if (jobs?.length) {
          const completedJobs = jobs.filter(j => j.status === 'completed').length;
          const failedJobs = jobs.filter(j => j.status === 'failed').length;
          const runningJobs = jobs.filter(j => 
            j.status === 'running' || j.status === 'queued' || j.status === 'pending'
          ).length;
          const total = jobs.length;

          console.log('[useOrderCompletion] Job status check:', { 
            completedJobs, 
            failedJobs, 
            runningJobs,
            total,
            jobStatuses: jobs.map(j => ({ id: j.id.slice(0, 8), status: j.status }))
          });

          // Only consider done when ALL jobs are completed or failed (no running jobs)
          const allDone = runningJobs === 0 && (completedJobs + failedJobs === total);

          if (allDone) {
            stopPolling();
            
            // Check for specific errors in failed jobs
            const failedJobsList = jobs.filter(j => j.status === 'failed');
            for (const failedJob of failedJobsList) {
              if (failedJob.error) {
                const errorData = { error: failedJob.error, message: failedJob.error };
                if (handleVideoGenerationError(errorData)) {
                  continue;
                }
              }
            }
            
            // Call the onComplete callback
            if (onComplete) {
              onComplete(completedJobs, failedJobs);
            }

            if (failedJobs === 0) {
              toast({
                title: "✅ Génération terminée !",
                description: isVideo 
                  ? "Ta vidéo est prête ! Retrouve-la dans la bibliothèque 🎬" 
                  : "Retrouve tes visuels dans la bibliothèque 🎨",
              });
            } else if (completedJobs > 0) {
              toast({
                title: "⚠️ Génération partiellement terminée",
                description: `${completedJobs}/${total} ${isVideo ? 'vidéo(s)' : 'visuels'} générés. Certains ont échoué.`,
                variant: "destructive",
              });
            } else {
              // Only show generic error if not already handled
              const hasSpecificError = failedJobsList.some(j => 
                j.error?.includes("CONTENT_POLICY") || j.error?.includes("INSUFFICIENT_WOOFS")
              );
              
              if (!hasSpecificError) {
                toast({
                  title: "❌ La génération a échoué",
                  description: failedJobsList[0]?.error || "Réessaie ou contacte le support.",
                  variant: "destructive",
                });
              }
            }
          }
          return;
        }

        // Fallback: Check orders table if no jobs found (legacy support)
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
            continue;
          }
        }

        // Tous terminés (succès ou échec)
        if (completed + failed === total) {
          stopPolling();
          
          if (onComplete) {
            onComplete(completed, failed);
          }

          if (failed === 0) {
            toast({
              title: "✅ Génération terminée !",
              description: isVideo 
                ? "Ta vidéo est prête ! Retrouve-la dans la bibliothèque 🎬" 
                : "Retrouve tes visuels dans la bibliothèque 🎨",
            });
          } else if (completed > 0) {
            toast({
              title: "⚠️ Génération partiellement terminée",
              description: `${completed}/${total} ${isVideo ? 'vidéo(s)' : 'visuels'} générés. Certains ont échoué.`,
              variant: "destructive",
            });
          } else {
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
