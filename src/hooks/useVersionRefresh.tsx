import { useEffect } from 'react';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || Date.now().toString();

export function useVersionRefresh() {
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');
    
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log('[Version] New version detected, refreshing...', { 
        old: storedVersion, 
        new: APP_VERSION 
      });
      
      // Clear minor caches (keep auth)
      try {
        // Clear all caches except authentication
        const keysToKeep = ['supabase.auth.token'];
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
            localStorage.removeItem(key);
          }
        });
      } catch (err) {
        console.warn('[Version] Cache clear failed:', err);
      }
      
      // Update version and reload
      localStorage.setItem('app_version', APP_VERSION);
      window.location.reload();
    } else if (!storedVersion) {
      // First visit, just set the version
      localStorage.setItem('app_version', APP_VERSION);
    }
  }, []);
  
  return APP_VERSION;
}
