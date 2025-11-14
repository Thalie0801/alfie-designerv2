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

export async function triggerGenerationFromChat(userId: string, intent: AlfieIntent) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch('/functions/v1/generate-media', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, intent }),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch (_error) {
    body = null;
  }

  const errorCode = typeof (body as { error?: unknown } | null)?.error === 'string'
    ? (body as { error: string }).error
    : undefined;

  if (!res.ok) {
    let message: string;
    if (errorCode === 'invalid_body') {
      message = 'Brief incomplet (marque / sujet / nombre).';
    } else if (errorCode) {
      message = `Erreur de génération : ${errorCode}`;
    } else {
      message = 'Erreur de génération.';
    }

    throw new GenerationError(message, res.status, errorCode);
  }

  const orderId = typeof (body as { orderId?: unknown } | null)?.orderId === 'string'
    ? (body as { orderId: string }).orderId
    : null;

  if (!orderId) {
    const message = 'Erreur de génération (aucun orderId renvoyé).';
    throw new GenerationError(message, res.status, 'missing_order_id');
  }

  return { orderId };
}
