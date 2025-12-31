/**
 * useJobProgress - Hook unifié pour suivre la progression des jobs
 * Remplace useVideoJobEvents avec support de tous les types de jobs
 */
import { useEffect, useState, useCallback } from 'react';
import { subscribeToJob, getJobStatus, retryStep as retryStepApi, type JobProgress } from '@/lib/jobClient';

export interface JobStep {
  id: string;
  job_id: string;
  step_type: string;
  step_index: number;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  attempt: number;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface JobProgressState {
  jobId: string;
  kind: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  steps: JobStep[];
  currentStepIndex: number;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  error: string | null;
  assets: Array<{ type: string; url: string }>;
}

export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState<JobProgressState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      const result = await getJobStatus(jobId);
      
      // Transform to full state format
      const stepsResponse = result as JobProgress & { 
        steps?: JobStep[]; 
        kind?: string;
      };
      
      // Build steps from completedSteps if not provided
      const steps: JobStep[] = stepsResponse.steps || [];
      const currentStep = steps.find(s => s.status === 'running') || 
                         steps.find(s => s.status === 'queued');

      setProgress({
        jobId,
        kind: stepsResponse.kind || 'unknown',
        status: result.status,
        steps,
        currentStepIndex: currentStep?.step_index ?? -1,
        completedSteps: result.completedSteps,
        totalSteps: result.totalSteps,
        percentComplete: result.totalSteps > 0 
          ? Math.round((result.completedSteps / result.totalSteps) * 100) 
          : 0,
        error: result.error || null,
        assets: result.assets || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Load initial data
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = subscribeToJob(jobId, async () => {
      // Reload full progress on any update
      await loadProgress();
    });

    return () => {
      unsubscribe();
    };
  }, [jobId, loadProgress]);

  // Retry a step
  const retryStep = useCallback(async (stepId: string) => {
    if (!jobId) return;

    try {
      await retryStepApi(jobId, stepId);
      await loadProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry step');
    }
  }, [jobId, loadProgress]);

  return {
    progress,
    loading,
    error,
    refresh: loadProgress,
    retryStep,
  };
}
