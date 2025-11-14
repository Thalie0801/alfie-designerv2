import { supabase } from '@/lib/supabaseClient';
import type { AlfieIntent } from '@/lib/types/alfie';

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

type GenerateImageResponse = {
  orderId?: unknown;
  jobId?: unknown;
  status?: unknown;
  message?: unknown;
  error?: unknown;
};

function normaliseError(message: string, status: number) {
  if (!message) {
    return { message: 'Generation failed', code: 'generation_failed' };
  }

  try {
    const parsed = JSON.parse(message) as { error?: string; message?: string };
    if (parsed && typeof parsed.error === 'string') {
      return { message: parsed.message ?? parsed.error, code: parsed.error };
    }
  } catch (_error) {
    // ignore JSON parse errors and fall back to raw message
  }

  return { message, code: message || `generation_failed_${status}` };
}

export async function triggerGenerationFromChat(userId: string, intent: AlfieIntent) {
  await supabase.auth.getSession();

  const payload: Record<string, unknown> = {
    brandId: intent.brandId,
    userId,
    prompt: intent.topic,
    format: intent.format,
    ratio: intent.ratio,
    metadata: {
      count: intent.count,
      platform: intent.platform,
      requestedBy: 'alfie-chat',
      userId,
      format: intent.format,
    },
  };

  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: payload,
  });

  if (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status?: number }).status ?? 500
      : 500;
    const { message, code } = normaliseError(error.message ?? 'Generation failed', status);
    throw new GenerationError(message, status, code);
  }

  const body = (data ?? {}) as GenerateImageResponse;

  if (typeof body.error === 'string') {
    throw new GenerationError(body.error, 500, body.error);
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId : null;
  if (!orderId) {
    throw new GenerationError('Erreur de génération (aucun orderId renvoyé).', 500, 'missing_order_id');
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId : null;

  return { orderId, jobId };
}
