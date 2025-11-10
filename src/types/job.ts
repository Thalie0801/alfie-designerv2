export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface JobQueue {
  id: string;
  status: JobStatus;
  created_at: string;
  locked_by?: string | null;
  locked_at?: string | null;
  next_run_at?: string | null;
  priority?: number | null;
  attempts?: number | null;
  payload?: unknown;
}
