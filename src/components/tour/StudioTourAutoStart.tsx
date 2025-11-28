import { useEffect } from "react";
import { useTour } from "./InteractiveTour";
import { useAuth } from "@/hooks/useAuth";
import { lsGet, studioCompletedKey } from "@/utils/localStorage";

interface StudioTourAutoStartProps {
  enabled?: boolean;
  maxWaitMs?: number;
}

/**
 * Auto-démarre le tour Studio lors de la première visite
 * Utilise localStorage pour tracker si l'utilisateur a déjà vu le tour
 */
export function StudioTourAutoStart({
  enabled = true,
  maxWaitMs = 3000,
}: StudioTourAutoStartProps = {}) {
  const { start } = useTour();
  const { user } = useAuth();

  useEffect(() => {
    if (!enabled || !user?.email) return;

    const completedKey = studioCompletedKey(user.email);
    const hasCompleted = lsGet(completedKey) === "true";

    if (hasCompleted) {
      console.log("[StudioTour] Already completed, skipping auto-start");
      return;
    }

    let rafId: number;
    let timeoutId: NodeJS.Timeout;
    let observer: MutationObserver;

    const checkTargets = () => {
      const selectors = [
        '[data-tour-id="studio-header"]',
        '[data-tour-id="studio-brief"]',
        '[data-tour-id="studio-assets"]',
      ];

      const allPresent = selectors.every((sel) => document.querySelector(sel));

      if (allPresent) {
        console.log("[StudioTour] All targets found, starting tour");
        observer?.disconnect();
        clearTimeout(timeoutId);
        cancelAnimationFrame(rafId);
        
        // Petit délai pour laisser le layout se stabiliser
        setTimeout(() => {
          start();
          // Marquer comme complété à la fin du tour (géré par TourProvider)
        }, 300);
      } else {
        rafId = requestAnimationFrame(checkTargets);
      }
    };

    // Observer le DOM pour détecter l'apparition des éléments
    observer = new MutationObserver(() => {
      rafId = requestAnimationFrame(checkTargets);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout de sécurité
    timeoutId = setTimeout(() => {
      console.log("[StudioTour] Timeout reached, stopping detection");
      observer?.disconnect();
      cancelAnimationFrame(rafId);
    }, maxWaitMs);

    // Premier check
    rafId = requestAnimationFrame(checkTargets);

    return () => {
      observer?.disconnect();
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
    };
  }, [enabled, user?.email, start, maxWaitMs]);

  return null;
}
