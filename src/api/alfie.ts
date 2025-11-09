import { supabase } from '@/lib/supabaseSafeClient';

type GenerationResponse = {
  ok: boolean;
  order_id: string;
  job_id: string;
};

type ProcessQueueResponse = {
  ok: boolean;
  processed: number;
};

export async function createGeneration(brandId: string, payload: any) {
  const { data, error } = await supabase.functions.invoke('alfie-generate', {
    body: { brand_id: brandId, payload },
  });
  if (error) throw new Error(error.message);
  return data as GenerationResponse;
}

export async function forceProcess() {
  const { data, error } = await supabase.functions.invoke('alfie-process-queue', {
    body: {},
  });
  if (error) throw new Error(error.message);
  return data as ProcessQueueResponse;
}
