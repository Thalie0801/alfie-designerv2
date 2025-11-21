/**
 * Hook personnalisé pour la gestion centralisée des erreurs
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { formatErrorMessage } from '@/lib/validation';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  customMessage?: string;
}

export function useErrorHandler() {
  const handleError = useCallback((
    error: any,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      customMessage
    } = options;

    // Log to console for debugging
    if (logToConsole) {
      console.error('[Error Handler]', error);
    }

    // Format user-friendly message
    const message = customMessage || formatErrorMessage(error);

    // Show toast notification
    if (showToast) {
      toast.error(message);
    }

    return message;
  }, []);

  const handleSuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const handleWarning = useCallback((message: string) => {
    toast.warning(message);
  }, []);

  const handleInfo = useCallback((message: string) => {
    toast.info(message);
  }, []);

  return {
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo
  };
}

/**
 * Hook pour gérer les erreurs asynchrones avec retry
 */
export function useAsyncErrorHandler() {
  const { handleError } = useErrorHandler();

  const withErrorHandling = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions & { retries?: number } = {}
  ): Promise<T | null> => {
    const { retries = 0, ...errorOptions } = options;
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error;
        
        if (attempt < retries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`Retry attempt ${attempt + 1}/${retries}...`);
        }
      }
    }

    handleError(lastError, errorOptions);
    return null;
  }, [handleError]);

  return { withErrorHandling };
}
