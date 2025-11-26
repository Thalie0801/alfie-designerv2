/**
 * Cache local des données auth critiques pour mode dégradé
 * TTL de 5 minutes pour éviter des données trop anciennes
 */

const CACHE_KEY_PREFIX = 'alfie_auth_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedAuthData {
  userId: string;
  email: string;
  roles: string[];
  plan: string | null;
  hasActivePlan: boolean;
  timestamp: number;
}

export function saveAuthToCache(authData: Omit<CachedAuthData, 'timestamp'>) {
  try {
    const cacheData: CachedAuthData = {
      ...authData,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY_PREFIX + authData.userId, JSON.stringify(cacheData));
    console.debug('[AuthCache] Saved to cache:', authData.email);
  } catch (error) {
    console.warn('[AuthCache] Failed to save cache:', error);
  }
}

export function loadAuthFromCache(userId: string): CachedAuthData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!cached) return null;

    const data: CachedAuthData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age > CACHE_TTL_MS) {
      console.debug('[AuthCache] Cache expired for:', data.email);
      clearAuthCache(userId);
      return null;
    }

    console.debug('[AuthCache] Loaded from cache:', data.email, { age: Math.round(age / 1000) + 's' });
    return data;
  } catch (error) {
    console.warn('[AuthCache] Failed to load cache:', error);
    return null;
  }
}

export function clearAuthCache(userId?: string) {
  try {
    if (userId) {
      localStorage.removeItem(CACHE_KEY_PREFIX + userId);
    } else {
      // Clear all auth caches
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_KEY_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.warn('[AuthCache] Failed to clear cache:', error);
  }
}
