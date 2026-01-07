/**
 * jobClient - Client unifié pour interagir avec le Job Engine
 * Utilisé par Studio, ChatWidget, et tout composant nécessitant des jobs
 */
import { supabase } from '@/integrations/supabase/client';
import type { JobSpecV1Type } from '@/types/jobSpec';

export interface JobStep {
  id: string;
  step_type: string;
  step_index: number;
  status: string;
  error?: string;
  output_json?: Record<string, unknown>;
}

export interface JobAsset {
  type: string;
  url: string;
  carouselId?: string;
  slideUrls?: string[];
}

export interface JobProgress {
  jobId: string;
  kind?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  currentStep?: string;
  completedSteps: number;
  totalSteps: number;
  error?: string;
  steps: JobStep[];
  assets?: JobAsset[];
}

export interface CreateJobResult {
  jobId: string;
  kind: string;
  steps: Array<{ id: string; step_type: string; step_index: number; status: string }>;
  woofsCost: number;
}

/**
 * Crée un nouveau job via l'orchestrateur unifié
 */
export async function createJob(spec: JobSpecV1Type): Promise<CreateJobResult> {
  const { data, error } = await supabase.functions.invoke('job-orchestrator', {
    body: { spec },
  });

  if (error) {
    console.error('[jobClient] createJob error:', error);
    // Try to extract detailed error from response
    const errorMessage = error.message || 'Failed to create job';
    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error('No response from job-orchestrator');
  }

  if (data.error) {
    console.error('[jobClient] Job creation failed:', data.error);
    throw new Error(data.error);
  }

  return data as CreateJobResult;
}

/**
 * Relance un step échoué
 */
export async function retryStep(jobId: string, stepId: string): Promise<void> {
  const { error } = await supabase
    .from('job_steps')
    .update({ status: 'queued', error: null, attempt: 0 })
    .eq('id', stepId)
    .eq('job_id', jobId);

  if (error) {
    throw new Error(`Failed to retry step: ${error.message}`);
  }

  // Trigger the step runner
  await supabase.functions.invoke('video-step-runner', {});
}

/**
 * Récupère l'état complet d'un job
 */
export async function getJobStatus(jobId: string): Promise<JobProgress> {
  const [jobResult, stepsResult] = await Promise.all([
    supabase
      .from('job_queue')
      .select('id, status, error, kind')
      .eq('id', jobId)
      .single(),
    supabase
      .from('job_steps')
      .select('id, step_type, step_index, status, error, output_json')
      .eq('job_id', jobId)
      .order('step_index', { ascending: true }),
  ]);

  if (jobResult.error) {
    throw new Error(`Failed to get job: ${jobResult.error.message}`);
  }

  const job = jobResult.data;
  const rawSteps = stepsResult.data || [];

  // Map steps to JobStep interface
  const steps: JobStep[] = rawSteps.map(s => ({
    id: s.id,
    step_type: s.step_type,
    step_index: s.step_index,
    status: s.status,
    error: s.error || undefined,
    output_json: s.output_json as Record<string, unknown> | undefined,
  }));

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const currentStep = steps.find(s => s.status === 'running')?.step_type;
  
  // ✅ FIX: Calcul du statut effectif basé sur les steps (anti-régression)
  // Corrige le cas où job_queue.status=completed mais des steps sont encore pending/running
  let effectiveStatus = job.status as JobProgress['status'];
  if (steps.length > 0) {
    const hasRunning = steps.some(s => s.status === 'running');
    const hasPending = steps.some(s => s.status === 'pending' || s.status === 'queued');
    const hasFailed = steps.some(s => s.status === 'failed');
    const allCompleted = steps.every(s => s.status === 'completed');
    
    if (hasFailed && job.status !== 'failed') {
      effectiveStatus = 'failed';
    } else if (allCompleted) {
      effectiveStatus = 'completed';
    } else if (hasRunning || hasPending) {
      effectiveStatus = 'running';
    }
  }

  // Collect assets from completed steps
  const assets: JobAsset[] = [];
  for (const step of steps) {
    if (step.status === 'completed' && step.output_json) {
      const output = step.output_json;
      if (output.imageUrl) assets.push({ type: 'image', url: output.imageUrl as string });
      if (output.keyframeUrl) assets.push({ type: 'keyframe', url: output.keyframeUrl as string });
      if (output.clipUrl) assets.push({ type: 'clip', url: output.clipUrl as string });
      if (output.voiceoverUrl) assets.push({ type: 'voiceover', url: output.voiceoverUrl as string });
      if (output.musicUrl) assets.push({ type: 'music', url: output.musicUrl as string });
      if (output.mixedVideoUrl) assets.push({ type: 'video', url: output.mixedVideoUrl as string });
      if (output.deliveredUrl) assets.push({ type: 'final', url: output.deliveredUrl as string });
    }
  }

  // ✅ FIXED: Retrieve carousels by order_id = jobId (most reliable method)
  const { data: carouselSlides } = await supabase
    .from('library_assets')
    .select('id, cloudinary_url, carousel_id, slide_index')
    .eq('order_id', jobId)
    .eq('type', 'carousel_slide')
    .not('carousel_id', 'is', null)
    .order('carousel_id')
    .order('slide_index', { ascending: true });

  if (carouselSlides && carouselSlides.length > 0) {
    const carouselMap = new Map<string, string[]>();
    for (const slide of carouselSlides) {
      if (!slide.carousel_id) continue;
      if (!carouselMap.has(slide.carousel_id)) {
        carouselMap.set(slide.carousel_id, []);
      }
      carouselMap.get(slide.carousel_id)!.push(slide.cloudinary_url);
    }

    // Add carousels as assets
    for (const [carouselId, slideUrls] of carouselMap) {
      if (slideUrls.length > 0) {
        assets.push({
          type: 'carousel',
          url: slideUrls[0], // First slide as preview
          carouselId,
          slideUrls,
        });
      }
    }
    console.log(`[getJobStatus] Found ${carouselMap.size} carousels for job ${jobId}`);
  }

  return {
    jobId: job.id,
    kind: job.kind || undefined,
    status: effectiveStatus, // ✅ Utilise le statut effectif basé sur les steps
    currentStep,
    completedSteps,
    totalSteps: steps.length,
    error: job.error || undefined,
    steps,
    assets,
  };
}

/**
 * S'abonne aux mises à jour en temps réel d'un job
 */
export function subscribeToJob(
  jobId: string,
  onUpdate: (progress: JobProgress) => void
): () => void {

  // Initial fetch
  getJobStatus(jobId)
    .then(progress => {
      onUpdate(progress);
    })
    .catch(console.error);

  // Subscribe to step changes
  const stepsChannel = supabase
    .channel(`job-steps-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_steps',
        filter: `job_id=eq.${jobId}`,
      },
      async () => {
        try {
          const progress = await getJobStatus(jobId);
          onUpdate(progress);
        } catch (error) {
          console.error('[subscribeToJob] Error refreshing status:', error);
        }
      }
    )
    .subscribe();

  // Subscribe to job changes
  const jobChannel = supabase
    .channel(`job-queue-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_queue',
        filter: `id=eq.${jobId}`,
      },
      async () => {
        try {
          const progress = await getJobStatus(jobId);
          onUpdate(progress);
        } catch (error) {
          console.error('[subscribeToJob] Error refreshing job status:', error);
        }
      }
    )
    .subscribe();

  // Subscribe to events
  const eventsChannel = supabase
    .channel(`job-events-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'job_events',
        filter: `job_id=eq.${jobId}`,
      },
      async () => {
        try {
          const progress = await getJobStatus(jobId);
          onUpdate(progress);
        } catch (error) {
          console.error('[subscribeToJob] Error on event:', error);
        }
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    supabase.removeChannel(stepsChannel);
    supabase.removeChannel(jobChannel);
    supabase.removeChannel(eventsChannel);
  };
}

/**
 * Clone un job avec une spec modifiée (rerun)
 */
export async function rerunJob(jobId: string, specOverrides?: Partial<JobSpecV1Type>): Promise<CreateJobResult> {
  // Get original spec
  const { data: job, error } = await supabase
    .from('job_queue')
    .select('spec_json')
    .eq('id', jobId)
    .single();

  if (error || !job?.spec_json) {
    throw new Error('Failed to get original job spec');
  }

  const originalSpec = job.spec_json as JobSpecV1Type;
  const newSpec = { ...originalSpec, ...specOverrides };

  return createJob(newSpec);
}

/**
 * Récupère les deliverables d'un job terminé
 */
export async function getJobDeliverables(jobId: string): Promise<Array<{
  id: string;
  type: string;
  url: string;
  status: string;
}>> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('id, type, url, status')
    .eq('job_id', jobId);

  if (error) {
    throw new Error(`Failed to get deliverables: ${error.message}`);
  }

  return (data || []).map(d => ({
    id: d.id,
    type: d.type,
    url: d.url || '',
    status: d.status || 'pending',
  }));
}
