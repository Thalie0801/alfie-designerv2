import { toast } from 'sonner';

type MaybeStatusError = {
  status?: number | string;
  code?: number | string;
  context?: { status?: number } | null;
  message?: string;
};

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as MaybeStatusError;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.code === 'number') return err.code;
  if (typeof err.context?.status === 'number') return err.context.status;
  return undefined;
}

function extractMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if ('message' in err) {
      const msg = err.message;
      if (typeof msg === 'string') {
        return msg;
      }
    }
  }
  
  return undefined;
}

export function notifyAuthGuard(error: unknown): boolean {
  const status = extractStatus(error);
  const message = extractMessage(error) ?? '';
  const normalizedMessage = message.toLowerCase();

  if (status === 401 || normalizedMessage.includes('401')) {
    toast.error('Authentification requise. Merci de vous reconnecter.');
    return true;
  }

  if (status === 403 || normalizedMessage.includes('403')) {
    toast.error("Accès refusé. Vérifiez vos droits d'accès.");
    return true;
  }

  if (status === 42501 || normalizedMessage.includes('42501')) {
    toast.error('Accès refusé par RLS.');
    return true;
  }

  return false;
}
