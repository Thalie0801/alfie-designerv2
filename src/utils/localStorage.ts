/**
 * SSR-safe localStorage utilities
 * All functions handle server-side rendering gracefully
 */

export function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, val: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, val);
  } catch {
    // Silent fail for quota exceeded or blocked storage
  }
}

export function lsRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Silent fail
  }
}

export const normalizeEmail = (e?: string | null): string => 
  (e ?? '').trim().toLowerCase();

export const completedKey = (email?: string | null): string => 
  `alfie.tour.completed:${normalizeEmail(email)}`;

export const autoCompletedKey = (email?: string | null): string => 
  `alfie.tour.auto-completed:${normalizeEmail(email)}`;
