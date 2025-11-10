import { fetchJSON } from '@/lib/http';
import { EDGE_BASE } from '@/lib/env';
import { supabase } from '@/lib/supabaseClient';

type GenerationResponse = {
  ok: boolean;
  order_id: string;
  job_id: string;
};

type ForceProcessJobsResponse = {
  processed: number;
  queuedBefore: number;
  queuedAfter: number;
};

export async function createGeneration(brandId: string, payload: unknown) {
  const edgeResponse = await callEdgeFunction<GenerationResponse & { ok: boolean }>(
    'alfie-generate',
    { brand_id: brandId, payload },
  );
  if (edgeResponse) {
    return edgeResponse;
  }

  const { data, error } = await supabase.functions.invoke('alfie-generate', {
    body: { brand_id: brandId, payload },
  });
  if (error) {
    const wrapped = new Error(error.message);
    const errorName = (error as { name?: string }).name;
    if (typeof errorName === 'string' && errorName.trim()) {
      wrapped.name = errorName;
    }
    const status =
      typeof (error as { context?: { status?: number } })?.context?.status === 'number'
        ? (error as { context?: { status?: number } }).context!.status
        : typeof (error as { status?: number }).status === 'number'
          ? (error as { status?: number }).status
          : undefined;
    if (typeof status === 'number') {
      (wrapped as Error & { status?: number }).status = status;
    }
    throw wrapped;
  }
  if (!data) {
    throw new Error('Réponse invalide du backend');
  }
  return data as GenerationResponse;
}

type SupabaseFunctionError = Error & {
  context?: { status?: number } | null;
  status?: number;
};

type WorkerError = Error & { status?: number; originalError?: unknown };

export async function forceProcessJobs(): Promise<ForceProcessJobsResponse> {
  const edgeResponse = await callEdgeFunction<ForceProcessJobsResponse & { ok: boolean }>(
    'trigger-job-worker',
    { source: 'studio-force' },
  );
  if (edgeResponse) {
    return {
      processed: edgeResponse.processed,
      queuedBefore: edgeResponse.queuedBefore,
      queuedAfter: edgeResponse.queuedAfter,
    };
  }

  const { data, error } = await supabase.functions.invoke('trigger-job-worker', {
    body: { source: 'studio-force' },
  });

  if (error) {
    const httpError = error as SupabaseFunctionError;
    const status =
      typeof httpError.context?.status === 'number'
        ? httpError.context.status
        : typeof httpError.status === 'number'
          ? httpError.status
          : undefined;

    const baseMessage = httpError.message ?? String(error);
    const message =
      status === 409
        ? 'Un traitement est déjà en cours.'
        : `trigger-job-worker: ${baseMessage}`;

    const wrappedError = new Error(message) as WorkerError;
    if (status !== undefined) {
      wrappedError.status = status;
    }
    wrappedError.originalError = error as unknown;

    throw wrappedError;
  }

  const payload = data as ForceProcessJobsResponse | undefined;
  if (!payload) {
    throw new Error('Réponse invalide du backend');
  }

  return {
    processed: typeof payload.processed === 'number' ? payload.processed : 0,
    queuedBefore: typeof payload.queuedBefore === 'number' ? payload.queuedBefore : 0,
    queuedAfter: typeof payload.queuedAfter === 'number' ? payload.queuedAfter : 0,
  };
}

const SUPABASE_EDGE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function callEdgeFunction<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!EDGE_BASE) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    const error = new Error('401 Session expirée. Réauthentification requise.');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  if (SUPABASE_EDGE_KEY) {
    headers.apikey = SUPABASE_EDGE_KEY;
  }

  const url = `${EDGE_BASE}/${path}`;
  const response = await fetchJSON<T>(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: 60_000,
  });

  return response;
}
