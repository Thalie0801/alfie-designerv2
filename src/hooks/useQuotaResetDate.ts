/**
 * Hook to compute quota reset date dynamically
 * Based on subscription period end or fallback to first day of next month
 */

export interface Subscription {
  current_period_end?: string | null;
}

export function useQuotaResetDate(subscription?: Subscription | null): Date {
  // If subscription has a current_period_end, use it
  if (subscription?.current_period_end) {
    try {
      return new Date(subscription.current_period_end);
    } catch {
      // Invalid date, fall through to fallback
    }
  }

  // Fallback: first day of next month
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 1);
}

export function formatResetDate(resetDate: Date): string {
  try {
    return resetDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch {
    return '1er du mois prochain';
  }
}
