import { fetchJSON } from '@/lib/http';
import { EDGE_BASE } from '@/lib/env';
import { supabase } from '@/lib/supabaseSafeClient';
import type { AlfieIntent } from '@/ai/intent';

type GenerationResponse = {
  order_id: string;
  job_id: string;
  job_type?: string;
};

type JobKind = 'image' | 'video' | 'carousel';

type CreateGenerationInput = {
  kind: JobKind;
  payload: Record<string, unknown>;
  stylePreset?: Record<string, unknown> | null;
  templateId?: string | null;
  orderId?: string | null;
};

type UnblockJobsResponse = {
  updated: number;
  blockedReset: number;
  processedIds: string[];
};

export type AlfieJobStatus = {
  id: string;
  status: string;
  type: string;
  orderId: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  events: Array<{
    id: number;
    kind: string;
    createdAt: string;
    message?: string | null;
  }>;
};

export type LibraryAsset = {
  id: string;
  orderId: string | null;
  kind: string;
  status: string;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  url?: string | null;
  createdAt: string;
  errorMessage?: string | null;
};

export type SearchAssetsResponse = {
  assets: LibraryAsset[];
  jobs: AlfieJobStatus[];
};

export type AlfieEnqueueResponse = {
  orderId: string;
  jobId: string;
  jobType?: string;
};

export async function createGeneration(brandId: string, input: CreateGenerationInput) {
  const sanitizedPayload: Record<string, unknown> = { ...input.payload };

  if (input.stylePreset) {
    sanitizedPayload.style_preset = input.stylePreset;
  }

  if (typeof input.templateId === 'string' && input.templateId.trim().length > 0) {
    sanitizedPayload.template_id = input.templateId.trim();
  }

  if (input.orderId) {
    sanitizedPayload.order_id = input.orderId;
  }

  const body = {
    brandId,
    kind: input.kind,
    payload: sanitizedPayload,
    orderId: input.orderId ?? null,
  };

  const edgeResponse = await callEdgeFunction<{ orderId: string; jobId: string; jobType?: string }>(
    'jobs/enqueue',
    body,
  );

  if (edgeResponse) {
    return {
      order_id: edgeResponse.orderId,
      job_id: edgeResponse.jobId,
      job_type: edgeResponse.jobType,
    } satisfies GenerationResponse;
  }

  const { data, error } = await supabase.functions.invoke('jobs-enqueue', {
    body,
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

  if (!data || typeof data !== 'object' || data === null) {
    throw new Error('Réponse invalide du backend');
  }

  const response = data as { orderId?: string; jobId?: string; jobType?: string };

  if (!response.orderId || !response.jobId) {
    throw new Error('Réponse invalide du backend');
  }

  return {
    order_id: response.orderId,
    job_id: response.jobId,
    job_type: response.jobType,
  } satisfies GenerationResponse;
}

export async function forceProcessJobs(jobIds: string[]): Promise<UnblockJobsResponse> {
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    throw new Error('Sélectionnez au moins un job à débloquer.');
  }

  const uniqueJobIds = Array.from(new Set(jobIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
  if (uniqueJobIds.length === 0) {
    throw new Error('Sélection invalide.');
  }

  const body = { jobIds: uniqueJobIds };

  const edgeResponse = await callEdgeFunction<UnblockJobsResponse>('jobs/unblock', body);
  if (edgeResponse) {
    return edgeResponse;
  }

  const { data, error } = await supabase.functions.invoke('jobs-unblock', { body });

  if (error) {
    throw new Error(error.message || 'jobs-unblock: erreur inconnue');
  }

  const payload = data as UnblockJobsResponse | undefined;
  if (!payload) {
    throw new Error('Réponse invalide du backend');
  }

  return {
    updated: typeof payload.updated === 'number' ? payload.updated : 0,
    blockedReset: typeof payload.blockedReset === 'number' ? payload.blockedReset : 0,
    processedIds: Array.isArray(payload.processedIds) ? payload.processedIds : [],
  };
}

export async function enqueueAlfieJob(intent: AlfieIntent): Promise<AlfieEnqueueResponse> {
  const body = { intent };

  const edgeResponse = await callEdgeFunction<AlfieEnqueueResponse>('alfie-enqueue-job', body);
  if (edgeResponse) {
    return edgeResponse;
  }

  const { data, error } = await supabase.functions.invoke('alfie-enqueue-job', { body });
  if (error) {
    throw new Error(error.message || 'alfie-enqueue-job: erreur inconnue');
  }

  const payload = data as AlfieEnqueueResponse | undefined;
  if (!payload?.orderId || !payload?.jobId) {
    throw new Error('Réponse invalide du backend');
  }

  return payload;
}

export async function searchAlfieAssets(
  brandId: string,
  orderId?: string | null,
): Promise<SearchAssetsResponse> {
  const body = { brandId, orderId: orderId ?? null };

  const edgeResponse = await callEdgeFunction<SearchAssetsResponse>('alfie-search-assets', body);
  if (edgeResponse) {
    return edgeResponse;
  }

  const { data, error } = await supabase.functions.invoke('alfie-search-assets', { body });
  if (error) {
    throw new Error(error.message || 'alfie-search-assets: erreur inconnue');
  }

  const payload = data as SearchAssetsResponse | undefined;
  if (!payload || !Array.isArray(payload.assets) || !Array.isArray(payload.jobs)) {
    throw new Error('Réponse invalide du backend');
  }

  return {
    assets: payload.assets,
    jobs: payload.jobs,
  };
}

export async function signAlfieUpload(params: {
  folder: string;
  publicId: string;
  tags: string[];
  context: Record<string, string>;
}): Promise<{ signature: string; timestamp: number; apiKey: string; cloudName: string }> {
  const body = params;

  const edgeResponse = await callEdgeFunction<{ signature: string; timestamp: number; apiKey: string; cloudName: string }>(
    'alfie-sign-upload',
    body,
  );
  if (edgeResponse) {
    return edgeResponse;
  }

  const { data, error } = await supabase.functions.invoke('alfie-sign-upload', { body });
  if (error) {
    throw new Error(error.message || 'alfie-sign-upload: erreur inconnue');
  }

  const payload = data as { signature?: string; timestamp?: number; apiKey?: string; cloudName?: string } | undefined;
  if (!payload?.signature || !payload?.timestamp || !payload?.apiKey || !payload?.cloudName) {
    throw new Error('Réponse invalide du backend');
  }

  return {
    signature: payload.signature,
    timestamp: payload.timestamp,
    apiKey: payload.apiKey,
    cloudName: payload.cloudName,
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
