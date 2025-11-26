import { toast } from "@/hooks/use-toast";

interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  silent?: boolean;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

/**
 * Wrapper de retry avec timeout court pour les opérations Supabase critiques
 * Utilise un backoff exponentiel : 1s, 2s, 4s
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { 
    maxRetries = DEFAULT_MAX_RETRIES, 
    timeoutMs = DEFAULT_TIMEOUT_MS,
    silent = false
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wrapper avec timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        ),
      ]);
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries - 1;
      
      console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed:`, error);

      if (isLastAttempt) {
        if (!silent) {
          toast({
            title: "Erreur de connexion",
            description: "Le service est temporairement indisponible. Réessayez dans quelques instants.",
            variant: "destructive",
          });
        }
        throw lastError;
      }

      // Backoff avant prochaine tentative
      const delay = BACKOFF_DELAYS[attempt] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
      
      if (!silent && attempt === 0) {
        toast({
          title: "Reconnexion en cours...",
          description: `Tentative ${attempt + 2}/${maxRetries}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed');
}
