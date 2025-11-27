import { supabase } from '@/integrations/supabase/client';
import type { AlfieIntent } from '@/lib/types/alfie';

interface GenerateMediaResponse {
  ok: boolean;
  error?: string;
  message?: string;
  data?: { orderId: string; jobId?: string };
  orderId?: string;
  jobId?: string;
}

export class GenerationError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GenerationError';
    this.status = status;
    this.code = code;
  }
}

export async function triggerGenerationFromChat(userId: string, intent: AlfieIntent) {
  const { data, error } = await supabase.functions.invoke<GenerateMediaResponse>(
    'generate-media',
    {
      body: { userId, intent },
    }
  );

  if (error) {
    let parsed: GenerateMediaResponse | null = null;
    try {
      parsed = JSON.parse(error.message) as GenerateMediaResponse;
    } catch (parseError) {
      parsed = null;
    }

    const status = (error as { status?: number }).status ?? 500;
    const message = parsed?.message ?? parsed?.error ?? error.message ?? 'Erreur génération';
    const code = parsed?.error;

    throw new GenerationError(message, status, code);
  }

  if (!data) {
    throw new GenerationError('Réponse vide du serveur', 500);
  }

  if (!data.ok) {
    const message = data.message ?? data.error ?? 'Erreur génération';
    throw new GenerationError(message, 400, data.error);
  }

  // Support à la fois l'ancien format (data.data.orderId) et le nouveau (data.orderId)
  const orderId = data.orderId ?? data.data?.orderId;
  if (!orderId) {
    throw new GenerationError('Pas d\'orderId dans la réponse', 500);
  }

  return { orderId };
}
