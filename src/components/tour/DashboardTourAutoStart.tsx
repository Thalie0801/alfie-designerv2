import { useEffect, useRef } from "react";
import { useTour } from "./InteractiveTour";
import { useAuth } from "@/hooks/useAuth";
import { autoCompletedKey, lsGet } from "@/utils/localStorage";

interface DashboardTourAutoStartProps {
  targets?: string[];
  maxWaitMs?: number;
  /** Par défaut true. Si false, ne lance jamais automatiquement (utile pour A/B tests) */
  enabled?: boolean;
}

/**
 * Auto-start le tour à la première connexion quand toutes les cibles sont prêtes.
 * À placer à l'intérieur d'un TourProvider.
 */
export function DashboardTourAutoStart({
  targets = [
    '[data-tour-id="nav-dashboard"]',
    '[data-tour-id="btn-create"]',
    '[data-tour-id="quick-actions"]',
    '[data-tour-id="quotas"]',
    '[data-tour-id="brand-kit"]',
    '[data-tour-id="add-brand"]',
    '[data-tour-id="news"]',
    '[data-tour-id="suggest"]',
    '[data-sidebar-id="library"]',
    '[data-sidebar-id="affiliate"]',
  ],
  maxWaitMs = 8000,
  enabled = true,
}: DashboardTourAutoStartProps) {
  const { user } = useAuth();
  const { start, isRunning } = useTour() as { start: () => void; isRunning?: boolean };

  const attemptedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    // garde : feature désactivée
    if (!enabled) return;

    // garde : 1 seule tentative par mount
    if (attemptedRef.current) return;
    if (!user?.email) return;

    // déjà complété pour cet utilisateur ?
    const key = autoCompletedKey(user.email);
    if (lsGet(key) === "1") {
      // déjà auto-completé auparavant => ne rien faire
      return;
    }

    attemptedRef.current = true;

    let cancelled = false;
    let timeoutId: number | undefined;
    let rafId: number | undefined;

    const hasAllTargets = () => targets.every((sel) => !!document.querySelector(sel));
    const isTabVisible = () => document.visibilityState === "visible";

    const log = (...args: any[]) => console.debug("[TourAutoStart]", ...args);

    const safeStart = () => {
      if (cancelled || startedRef.current || isRunning) return;
      startedRef.current = true;

      // petit délai pour laisser le layout se stabiliser
      const run = () => {
        if (cancelled) return;
        log("Starting tour");
        start();
      };

      // requestIdleCallback n’existe pas partout
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(() => setTimeout(run, 0), { timeout: 500 });
      } else {
        setTimeout(run, 0);
      }
    };

    const tryStart = () => {
      if (cancelled) return;
      if (!isTabVisible()) return; // n’auto-démarre pas onglet caché
      if (hasAllTargets()) {
        cleanup();
        safeStart();
      }
    };

    const mo = new MutationObserver(() => {
      tryStart();
    });

    // Observations larges : on évite attributeFilter trop strict
    if (document.body) {
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    // Polling léger (raf) pour les cas où les mutations ne suffisent pas (portals, microtasks)
    const pump = () => {
      if (cancelled) return;
      tryStart();
      rafId = requestAnimationFrame(pump);
    };
    rafId = requestAnimationFrame(pump);

    // essayer immédiatement
    log("Waiting for targets", targets);
    tryStart();

    // sécurité : on abandonne après maxWaitMs
    timeoutId = window.setTimeout(() => {
      if (cancelled || startedRef.current) return;
      cleanup();
      log("Timeout reached, targets not found");
    }, maxWaitMs);

    // nettoyage
    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      mo.disconnect();
    }

    // annulation si user change, unmount, etc.
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [user?.email, enabled, targets, maxWaitMs, start, isRunning]);

  return null;
}
