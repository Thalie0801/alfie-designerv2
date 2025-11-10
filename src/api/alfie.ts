import { fetchJSON } from '@/lib/http';
import { EDGE_BASE } from '@/lib/env';
import { supabase } from '@/lib/supabaseClient';

type GenerationResponse = {
  ok: boolean;
  order_id: string;
  job_id: string;
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
  const payload = { source: 'studio-force' } as const;

  try {
    const edgeResponse = await callEdgeFunction<ForceProcessJobsResponse & { ok: boolean }>(
      'force-process',
      payload,
    );
    if (edgeResponse) {
      return normalizeForceProcessPayload(edgeResponse);
    }
  } catch (err) {
    console.warn('[forceProcessJobs] Edge force-process failed, falling back to Supabase', err);
  }

  try {
    return await invokeForceProcessViaSupabase('force-process', payload);
  } catch (err) {
    if (isFunctionMissingError(err)) {
      return await invokeForceProcessViaSupabase('trigger-job-worker', payload);
    }
    throw err;
  }
}

async function invokeForceProcessViaSupabase(
  functionName: 'force-process' | 'trigger-job-worker',
  body: Record<string, unknown>,
): Promise<ForceProcessJobsResponse> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

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
        : `${functionName}: ${baseMessage}`;

    const wrappedError = new Error(message) as WorkerError;
    if (status !== undefined) {
      wrappedError.status = status;
    }
    wrappedError.originalError = error as unknown;

    throw wrappedError;
  }

  const payload = data as Partial<ForceProcessJobsResponse> | undefined;
  if (!payload) {
    throw new Error('Réponse invalide du backend');
  }

  return normalizeForceProcessPayload(payload);
}

function normalizeForceProcessPayload(payload: Partial<ForceProcessJobsResponse>): ForceProcessJobsResponse {
  return {
    processed: typeof payload.processed === 'number' ? payload.processed : 0,
    queuedBefore: typeof payload.queuedBefore === 'number' ? payload.queuedBefore : 0,
    queuedAfter: typeof payload.queuedAfter === 'number' ? payload.queuedAfter : 0,
  };
}

function isFunctionMissingError(error: unknown) {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && 'message' in (error as Record<string, unknown>)
        ? String((error as { message?: unknown }).message)
        : '';
  return typeof message === 'string' && /not\s+found|does not exist/i.test(message);
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
