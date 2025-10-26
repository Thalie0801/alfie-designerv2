import { useEffect, useRef } from 'react';
import { useTour } from './InteractiveTour';
import { useAuth } from '@/hooks/useAuth';
import { autoCompletedKey, lsGet } from '@/utils/localStorage';

interface DashboardTourAutoStartProps {
  targets?: string[];
  maxWaitMs?: number;
}

/**
 * Auto-starts the tour on first login when DOM targets are ready
 * This component should be placed inside a TourProvider
 */
export function DashboardTourAutoStart({ 
  targets = [
    '[data-tour-id="nav-dashboard"]',
    '[data-tour-id="btn-create"]',
    '[data-tour-id="brand-kit"]',
    '[data-tour-id="quick-actions"]',
  ],
  maxWaitMs = 8000 
}: DashboardTourAutoStartProps) {
  const { user } = useAuth();
  const { start } = useTour();
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Only run once per mount
    if (attemptedRef.current || !user?.email) return;
    attemptedRef.current = true;

    // Check if tour already auto-completed for this user
    const key = autoCompletedKey(user.email);
    if (lsGet(key) === '1') {
      console.debug('[TourAutoStart] Tour already auto-completed for', user.email);
      return;
    }

    console.debug('[TourAutoStart] Waiting for targets:', targets);

    let ready = false;
    let timeoutId: number | undefined;

    // Check if all targets exist in DOM
    const hasAllTargets = () => targets.every(sel => !!document.querySelector(sel));

    const tryStart = () => {
      if (hasAllTargets()) {
        ready = true;
        console.debug('[TourAutoStart] All targets ready, starting tour');
        start();
        mo.disconnect();
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Watch DOM for target elements
    const mo = new MutationObserver(() => {
      if (!ready) tryStart();
    });

    mo.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour-id']
    });

    // Try immediately in case targets already exist
    tryStart();

    // Safety timeout - give up after maxWaitMs
    timeoutId = window.setTimeout(() => {
      if (!ready) {
        console.debug('[TourAutoStart] Timeout reached, targets not found');
        mo.disconnect();
      }
    }, maxWaitMs);

    return () => {
      mo.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, start, targets, maxWaitMs]);

  return null;
}
