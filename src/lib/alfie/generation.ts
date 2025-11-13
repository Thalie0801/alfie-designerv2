import type { AlfieIntent } from '@/lib/types/alfie';

interface GenerateMediaResponse {
  ok: boolean;
  error?: string;
  message?: string;
  data?: { orderId: string };
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
  const res = await fetch('/functions/v1/generate-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, intent }),
  });

  let json: GenerateMediaResponse;
  try {
    json = (await res.json()) as GenerateMediaResponse;
  } catch (error) {
    throw new GenerationError('Réponse invalide du serveur', res.status);
  }

  if (!res.ok || !json.ok) {
    const message = json.message ?? json.error ?? 'Erreur génération';
    throw new GenerationError(message, res.status, json.error);
  }

  return json.data as { orderId: string };
}
