/**
 * Job requeue helpers for Alfie Designer
 * Ensures jobs are properly reset without creating duplicates
 */

import { supabase } from '@/integrations/supabase/client';
import { buildJobIdempotencyKey } from './idempotency';

export interface JobToRequeue {
  id: string;
  user_id: string;
  order_id?: string | null;
  type: string;
  payload: unknown;
}

/**
 * Requeue a job by updating the existing row (not inserting a duplicate)
 * This resets the job to 'queued' status and clears error state
 */
export async function requeueJob(job: JobToRequeue): Promise<{ success: boolean; error?: string }> {
  try {
    // Build idempotency key to ensure uniqueness
    const idempotency_key = buildJobIdempotencyKey({
      orderId: job.order_id ?? null,
      userId: job.user_id,
      type: job.type,
      payload: job.payload ?? null,
    });

    // UPDATE the existing job row (not INSERT)
    const { error } = await supabase
      .from('job_queue')
      .update({
        status: 'queued',
        error: null,
        locked_by: null,
        started_at: null,
        attempts: 0,
        updated_at: new Date().toISOString(),
        idempotency_key,
      })
      .eq('id', job.id)
      .eq('user_id', job.user_id);

    if (error) {
      console.error('[Requeue] Error updating job:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Requeue] Exception:', err);
    return { success: false, error: message };
  }
}

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Sanitize orderId from URL params
 * Returns null if invalid UUID
 */
export function sanitizeOrderId(orderId: string | null | undefined): string | null {
  if (!orderId) return null;
  return isValidUUID(orderId) ? orderId : null;
}
