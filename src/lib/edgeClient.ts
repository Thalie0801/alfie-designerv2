/**
 * Unified Edge Function Client
 * Handles retries, error reporting, and consistent response handling
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EdgeResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function callEdge<T = any>(
  functionName: string,
  body: any,
  options?: { retries?: number; silent?: boolean }
): Promise<EdgeResponse<T>> {
  const maxRetries = options?.retries ?? 2;
  const silent = options?.silent ?? false;
  let lastError: string = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        lastError = error.message || 'INVOKE_ERROR';
        console.error(`[callEdge] ${functionName} attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError);
        
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Backoff exponentiel
          continue;
        }
        
        if (!silent) {
          toast.error(`Erreur: ${lastError}`);
        }
        return { ok: false, error: lastError };
      }

      // Edge a renvoyé 200, mais payload peut avoir ok:false
      if (!data || !data.ok) {
        const errorMsg = data?.error || 'UNKNOWN_ERROR';
        if (!silent) {
          toast.error(`Erreur: ${errorMsg}`);
        }
        return { ok: false, error: errorMsg, code: data?.code };
      }

      return { ok: true, data: data.data };
    } catch (e: any) {
      lastError = e.message || 'FETCH_ERROR';
      console.error(`[callEdge] ${functionName} attempt ${attempt + 1}/${maxRetries + 1} exception:`, e);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  if (!silent) {
    toast.error(`Échec après ${maxRetries + 1} tentatives`);
  }
  return { ok: false, error: lastError };
}
