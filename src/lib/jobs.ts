import { supabase } from '@/lib/supabase';
import type { JobQueueType } from '@/lib/types/jobQueue';

export async function enqueueJob(params: {
  type: JobQueueType;
  payload?: Record<string, unknown>;
  order_id?: string | null;
  brand_id?: string | null;
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Non authentifié');

  const { error } = await supabase.from('job_queue').insert([
    {
      user_id: user.id,
      order_id: params.order_id ?? null,
      brand_id: params.brand_id ?? null,
      type: params.type,
      status: 'queued',
      payload: params.payload ?? {},
    },
  ]);

  if (error) throw error;
}
