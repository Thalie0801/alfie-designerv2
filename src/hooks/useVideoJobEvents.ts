import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JobEvent {
  id: string;
  job_id: string;
  step_id: string | null;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

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

export interface JobProgress {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  steps: JobStep[];
  events: JobEvent[];
  currentStepIndex: number;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  error: string | null;
}

export function useVideoJobEvents(jobId: string | null) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les steps et events initiaux
  const loadProgress = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      // Charger les steps - utiliser any pour contourner le typage strict
      const { data: steps, error: stepsError } = await (supabase
        .from('job_steps' as any)
        .select('*')
        .eq('job_id', jobId)
        .order('step_index', { ascending: true }) as any);

      if (stepsError) throw stepsError;

      // Charger les events récents - utiliser any pour contourner le typage strict
      const { data: events, error: eventsError } = await (supabase
        .from('job_events' as any)
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(50) as any);

      if (eventsError) throw eventsError;

      // Charger le job parent
      const { data: job, error: jobError } = await supabase
        .from('job_queue')
        .select('status, error')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      // Calculer la progression
      const typedSteps = (steps || []) as JobStep[];
      const completedSteps = typedSteps.filter(s => s.status === 'completed').length;
      const totalSteps = typedSteps.length;
      const currentStep = typedSteps.find(s => s.status === 'running') || 
                         typedSteps.find(s => s.status === 'queued');

      setProgress({
        jobId,
        status: job.status as JobProgress['status'],
        steps: typedSteps,
        events: (events || []) as JobEvent[],
        currentStepIndex: currentStep?.step_index ?? -1,
        completedSteps,
        totalSteps,
        percentComplete: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        error: job.error,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Charger au montage
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Écouter les événements en temps réel
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-events-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_events',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const newEvent = payload.new as JobEvent;
          
          setProgress(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              events: [newEvent, ...prev.events].slice(0, 50),
            };
          });

          // Recharger les steps si événement important
          if (['step_completed', 'step_failed', 'job_completed'].includes(newEvent.event_type)) {
            loadProgress();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, loadProgress]);

  // Retry un step manuellement
  const retryStep = useCallback(async (stepId: string) => {
    if (!jobId) return;

    try {
      // Remettre le step en queued
      const { error } = await (supabase
        .from('job_steps' as any)
        .update({ status: 'queued', error: null, attempt: 0 })
        .eq('id', stepId) as any);

      if (error) throw error;

      // Déclencher le step runner
      await supabase.functions.invoke('video-step-runner', {
        body: { jobId },
      });

      // Recharger
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
