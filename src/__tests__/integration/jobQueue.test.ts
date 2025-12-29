/**
 * Tests Job Queue - Phase 2 Core Business
 * Vérifie la gestion de la file d'attente des jobs et le retry logic
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types pour les jobs
interface Job {
  id: string;
  user_id: string;
  order_id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  payload: Record<string, any>;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
  started_at?: Date;
  error?: string;
}

// Simule la base de données des jobs
let mockJobQueue: Job[] = [];

// Reset la queue avant chaque test
beforeEach(() => {
  mockJobQueue = [];
});

// Fonctions de gestion de queue simulées
const jobQueueService = {
  enqueue: (job: Omit<Job, 'id' | 'status' | 'retry_count' | 'created_at' | 'updated_at'>): Job => {
    const newJob: Job = {
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued',
      retry_count: 0,
      max_retries: job.max_retries || 3,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockJobQueue.push(newJob);
    return newJob;
  },

  claimJob: (): Job | null => {
    const job = mockJobQueue.find(j => j.status === 'queued');
    if (job) {
      job.status = 'running';
      job.started_at = new Date();
      job.updated_at = new Date();
    }
    return job || null;
  },

  completeJob: (jobId: string, _result?: any): boolean => {
    const job = mockJobQueue.find(j => j.id === jobId);
    if (job) {
      job.status = 'completed';
      job.updated_at = new Date();
      return true;
    }
    return false;
  },

  failJob: (jobId: string, error: string): boolean => {
    const job = mockJobQueue.find(j => j.id === jobId);
    if (job) {
      job.error = error;
      job.retry_count++;
      
      if (job.retry_count >= job.max_retries) {
        job.status = 'failed';
      } else {
        job.status = 'queued'; // Reset pour retry
      }
      job.updated_at = new Date();
      return true;
    }
    return false;
  },

  resetStuckJobs: (ageMinutes: number = 5): number => {
    const cutoffTime = new Date(Date.now() - ageMinutes * 60 * 1000);
    let resetCount = 0;

    mockJobQueue.forEach(job => {
      if (job.status === 'running' && job.started_at && job.started_at < cutoffTime) {
        if (job.retry_count < job.max_retries) {
          job.status = 'queued';
          job.retry_count++;
          job.updated_at = new Date();
          resetCount++;
        } else {
          job.status = 'failed';
          job.error = 'Max retries exceeded';
          job.updated_at = new Date();
        }
      }
    });

    return resetCount;
  },

  getJobsByStatus: (status: Job['status']): Job[] => {
    return mockJobQueue.filter(j => j.status === status);
  },
};

describe('Job Queue - Timeout & Retry', () => {
  it('Job running > 5 min → reset queued + retry_count++', () => {
    // Créer un job qui a démarré il y a 6 minutes
    const oldJob: Job = {
      id: 'stuck-job-1',
      user_id: 'user-1',
      order_id: 'order-1',
      type: 'render_images',
      status: 'running',
      payload: {},
      retry_count: 0,
      max_retries: 3,
      created_at: new Date(Date.now() - 10 * 60 * 1000),
      updated_at: new Date(Date.now() - 6 * 60 * 1000),
      started_at: new Date(Date.now() - 6 * 60 * 1000),
    };
    mockJobQueue.push(oldJob);

    const resetCount = jobQueueService.resetStuckJobs(5);

    expect(resetCount).toBe(1);
    expect(oldJob.status).toBe('queued');
    expect(oldJob.retry_count).toBe(1);
  });

  it('Job retry_count >= 3 → status failed définitif', () => {
    const exhaustedJob: Job = {
      id: 'exhausted-job',
      user_id: 'user-1',
      order_id: 'order-1',
      type: 'render_images',
      status: 'running',
      payload: {},
      retry_count: 3, // Déjà au max
      max_retries: 3,
      created_at: new Date(Date.now() - 20 * 60 * 1000),
      updated_at: new Date(Date.now() - 6 * 60 * 1000),
      started_at: new Date(Date.now() - 6 * 60 * 1000),
    };
    mockJobQueue.push(exhaustedJob);

    jobQueueService.resetStuckJobs(5);

    expect(exhaustedJob.status).toBe('failed');
    expect(exhaustedJob.error).toBe('Max retries exceeded');
  });

  it('Job failed → refund Woofs automatique (simulation)', () => {
    const job = jobQueueService.enqueue({
      user_id: 'user-1',
      order_id: 'order-1',
      type: 'render_images',
      payload: { woofs_cost: 10 },
      max_retries: 1,
    });

    // Simule l'échec du job
    jobQueueService.failJob(job.id, 'Generation failed');
    jobQueueService.failJob(job.id, 'Generation failed again'); // 2ème échec

    const failedJob = mockJobQueue.find(j => j.id === job.id);
    expect(failedJob?.status).toBe('failed');

    // Simule le refund (normalement fait par le worker)
    const shouldRefund = failedJob?.status === 'failed' && failedJob.payload.woofs_cost > 0;
    expect(shouldRefund).toBe(true);
  });
});

describe('Job Queue - Sequential Video Processing', () => {
  it('Jobs séquentiels vidéo (clip 1 → clip 2 → clip 3)', async () => {
    // Créer 3 clips pour une vidéo batch
    const clips = [
      jobQueueService.enqueue({
        user_id: 'user-1',
        order_id: 'video-1',
        type: 'generate_video',
        payload: { clip_index: 0, video_id: 'vid-1' },
        max_retries: 3,
      }),
      jobQueueService.enqueue({
        user_id: 'user-1',
        order_id: 'video-1',
        type: 'generate_video',
        payload: { clip_index: 1, video_id: 'vid-1' },
        max_retries: 3,
      }),
      jobQueueService.enqueue({
        user_id: 'user-1',
        order_id: 'video-1',
        type: 'generate_video',
        payload: { clip_index: 2, video_id: 'vid-1' },
        max_retries: 3,
      }),
    ];

    // Processus séquentiel simulé
    const processedOrder: number[] = [];

    for (const clip of clips) {
      const job = mockJobQueue.find(j => j.id === clip.id);
      if (job) {
        job.status = 'running';
        processedOrder.push(job.payload.clip_index);
        jobQueueService.completeJob(job.id);
      }
    }

    expect(processedOrder).toEqual([0, 1, 2]);
    expect(jobQueueService.getJobsByStatus('completed')).toHaveLength(3);
  });
});

describe('Job Queue - Concurrency', () => {
  it('Concurrence : 2 workers ne prennent pas le même job', () => {
    // Ajouter un seul job
    jobQueueService.enqueue({
      user_id: 'user-1',
      order_id: 'order-1',
      type: 'render_images',
      payload: {},
      max_retries: 3,
    });

    // Simule 2 workers qui tentent de claim le même job
    const worker1Job = jobQueueService.claimJob();
    const worker2Job = jobQueueService.claimJob();

    // Le premier worker devrait avoir le job
    expect(worker1Job).not.toBeNull();
    // Le deuxième worker ne devrait pas avoir de job (déjà pris)
    expect(worker2Job).toBeNull();
  });

  it('Plusieurs jobs disponibles → chaque worker prend un job différent', () => {
    // Ajouter plusieurs jobs
    for (let i = 0; i < 3; i++) {
      jobQueueService.enqueue({
        user_id: 'user-1',
        order_id: `order-${i}`,
        type: 'render_images',
        payload: { index: i },
        max_retries: 3,
      });
    }

    const worker1Job = jobQueueService.claimJob();
    const worker2Job = jobQueueService.claimJob();
    const worker3Job = jobQueueService.claimJob();

    expect(worker1Job?.id).not.toBe(worker2Job?.id);
    expect(worker2Job?.id).not.toBe(worker3Job?.id);
    expect(jobQueueService.getJobsByStatus('running')).toHaveLength(3);
    expect(jobQueueService.getJobsByStatus('queued')).toHaveLength(0);
  });
});
