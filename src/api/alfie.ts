import { supabase } from '@/lib/supabaseSafeClient';

type GenerationResponse = {
  ok: boolean;
  order_id: string;
  job_id: string;
};

type ForceProcessJobsResponse = {
  processed: number;
  queuedBefore?: number;
  queuedAfter?: number;
};

export async function createGeneration(brandId: string, payload: any) {
  const { data, error } = await supabase.functions.invoke('alfie-generate', {
    body: { brand_id: brandId, payload },
  });
  if (error) throw new Error(error.message);
  return data as GenerationResponse;
}

export async function forceProcessJobs() {
  const { data, error } = await supabase.functions.invoke('trigger-job-worker', {
    body: { source: 'studio-force' },
  });
  if (error) {
    throw new Error(`trigger-job-worker: ${error.message}`);
  }
  return data as ForceProcessJobsResponse | undefined;
}
