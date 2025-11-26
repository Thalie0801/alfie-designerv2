import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/lib/supabaseRetry';

/**
 * Hook pour vérifier la santé de Supabase au démarrage
 * Utilise un simple SELECT 1 pour tester la connexion
 */
export function useSupabaseHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      // Simple health check avec retry
      await withRetry(
        async () => {
          const { error } = await supabase.from('profiles').select('count').limit(0).single();
          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (OK pour health check)
            throw error;
          }
        },
        { maxRetries: 3, timeoutMs: 5000, silent: true }
      );
      
      console.log('[SupabaseHealth] ✅ Database is healthy');
      setIsHealthy(true);
    } catch (error) {
      console.error('[SupabaseHealth] ❌ Database health check failed:', error);
      setIsHealthy(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return {
    isHealthy,
    isChecking,
    retry: checkHealth,
  };
}
