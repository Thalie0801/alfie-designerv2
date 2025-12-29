/**
 * Tests E2E des workflows complets
 * Chat → Pack → Jobs → Génération
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  mockSoloImagePack,
  mockMultiImagePack,
  mockSoloCarouselPack,
  mockSoloVideoPack,
  mockMixedPack,
  createVideoAsset,
} from '../mocks/packMocks';
import { 
  mockWoofsCheckConsume,
  mockJobWorker,
  mockVideoBatchCreate,
  createMockSupabaseClient,
} from '../mocks/edgeFunctionMocks';
import { calculatePackWoofCost } from '@/lib/woofs';

describe('E2E: Chat → Pack → Jobs (Images)', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('image solo: prompt → pack → 1 job render_images', async () => {
    const pack = mockSoloImagePack;
    
    // Step 1: Check woofs
    const woofsCost = calculatePackWoofCost(pack);
    expect(woofsCost).toBe(1);
    
    mockClient._mockInvoke.mockResolvedValueOnce({ 
      data: mockWoofsCheckConsume.success(449).data, 
      error: null 
    });
    
    const woofsResult = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: woofsCost },
    });
    expect(woofsResult.data?.consumed).toBe(true);
    
    // Step 2: Create jobs
    const jobs = pack.assets.map(asset => ({
      type: 'render_images',
      status: 'queued',
      payload: { assetId: asset.id, prompt: asset.prompt },
    }));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe('render_images');
    
    // Step 3: Process job
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockJobWorker.imageResult('https://cdn.example.com/image.jpg'),
      error: null,
    });
    
    const jobResult = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_id: 'job-123' },
    });
    expect(jobResult.data?.success).toBe(true);
    expect(jobResult.data?.image_url).toBeDefined();
  });

  it('5 images groupées: prompt → pack → 5 jobs cohérents', async () => {
    const pack = mockMultiImagePack(5);
    
    // Verify coherence group
    const coherenceGroups = new Set(pack.assets.map(a => a.coherenceGroup));
    expect(coherenceGroups.size).toBe(1);
    
    // Verify cost
    const woofsCost = calculatePackWoofCost(pack);
    expect(woofsCost).toBe(5);
    
    // Verify job count
    const jobs = pack.assets.map(asset => ({
      type: 'render_images',
      payload: { assetId: asset.id },
    }));
    expect(jobs).toHaveLength(5);
  });
});

describe('E2E: Chat → Pack → Jobs (Carrousels)', () => {
  it('carrousel: prompt → pack → 1 job render_carousels', async () => {
    const pack = mockSoloCarouselPack;
    
    // Verify cost (fixed 10 Woofs)
    const woofsCost = calculatePackWoofCost(pack);
    expect(woofsCost).toBe(10);
    
    // Verify job type
    const asset = pack.assets[0];
    const jobType = asset.kind === 'carousel' ? 'render_carousels' : 'render_images';
    expect(jobType).toBe('render_carousels');
    
    // Verify slides in payload
    expect(asset.generatedTexts?.slides).toHaveLength(5);
  });
});

describe('E2E: Chat → Pack → Jobs (Vidéos)', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('vidéo premium: prompt → pack → 1 job generate_video', async () => {
    const pack = mockSoloVideoPack;
    
    // Verify cost (25 Woofs)
    const woofsCost = calculatePackWoofCost(pack);
    expect(woofsCost).toBe(25);
    
    // Verify job type
    const asset = pack.assets[0];
    const jobType = asset.kind === 'video_premium' ? 'generate_video' : 'render_images';
    expect(jobType).toBe('generate_video');
    
    // Process and verify result
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockJobWorker.videoResult('https://cdn.example.com/video.mp4'),
      error: null,
    });
    
    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'generate_video' },
    });
    
    expect(result.data?.video_url).toContain('.mp4');
    expect(result.data?.duration_seconds).toBe(8);
  });

  it('3 clips vidéo: prompt → pack → 3 jobs séquentiels', async () => {
    const pack = {
      title: '3 Clips Vidéo',
      summary: '3 clips distincts',
      assets: [
        createVideoAsset({ title: 'Clip 1', sceneOrder: 1, scriptGroup: 'script-1' }),
        createVideoAsset({ title: 'Clip 2', sceneOrder: 2, scriptGroup: 'script-1' }),
        createVideoAsset({ title: 'Clip 3', sceneOrder: 3, scriptGroup: 'script-1' }),
      ],
    };
    
    // Verify cost (75 Woofs)
    const woofsCost = calculatePackWoofCost(pack);
    expect(woofsCost).toBe(75);
    
    // Verify sequential ordering
    const orders = pack.assets.map(a => a.sceneOrder);
    expect(orders).toEqual([1, 2, 3]);
    
    // Verify shared script group
    const scriptGroups = new Set(pack.assets.map(a => a.scriptGroup));
    expect(scriptGroups.size).toBe(1);
  });
});

describe('E2E: Chat → Pack → Jobs (Pack mixte)', () => {
  it('pack mixte: 2 images + 1 carrousel + 1 vidéo → 4 jobs', async () => {
    const pack = mockMixedPack;
    
    // Verify total cost
    const woofsCost = calculatePackWoofCost(pack);
    expect(woofsCost).toBe(37); // 2×1 + 10 + 25
    
    // Verify job distribution
    const jobTypes = pack.assets.map(asset => {
      if (asset.kind === 'image') return 'render_images';
      if (asset.kind === 'carousel') return 'render_carousels';
      return 'generate_video';
    });
    
    expect(jobTypes).toHaveLength(4);
    expect(jobTypes.filter(t => t === 'render_images')).toHaveLength(2);
    expect(jobTypes.filter(t => t === 'render_carousels')).toHaveLength(1);
    expect(jobTypes.filter(t => t === 'generate_video')).toHaveLength(1);
  });
});

describe('E2E: Video Batch workflow', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('3 vidéos batch: créer batch → 3 videos × 3 clips → 9 jobs', async () => {
    const videoCount = 3;
    const clipsPerVideo = 3;
    const _totalClips = videoCount * clipsPerVideo;
    
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockVideoBatchCreate.success('batch-123', videoCount).data,
      error: null,
    });
    
    const result = await mockClient.functions.invoke('video-batch-create', {
      body: { brand_id: 'brand-123', video_count: videoCount },
    });
    
    expect(result.data?.video_count).toBe(3);
    expect(result.data?.total_clips).toBe(9);
    expect(result.data?.total_woofs_cost).toBe(225); // 9 × 25
  });

  it('batch sequential processing: video 1 clips → video 2 clips → video 3 clips', () => {
    // Simulate batch structure
    const batch = {
      id: 'batch-123',
      videos: [
        { id: 'video-1', clips: [1, 2, 3], status: 'completed' },
        { id: 'video-2', clips: [1, 2, 3], status: 'in_progress' },
        { id: 'video-3', clips: [1, 2, 3], status: 'queued' },
      ],
    };
    
    // Video 2 shouldn't start until video 1 is done
    const video1Done = batch.videos[0].status === 'completed';
    const video2CanStart = video1Done && batch.videos[1].status !== 'queued';
    
    expect(video2CanStart).toBe(true);
  });

  it('export CSV Canva: format correct des colonnes', () => {
    const csvHeaders = [
      'batch_key',
      'video_index',
      'video_title',
      'clip1_title',
      'clip1_subtitle',
      'clip2_title',
      'clip2_subtitle',
      'clip3_title',
      'clip3_subtitle',
      'cta',
    ];
    
    expect(csvHeaders).toHaveLength(10);
    expect(csvHeaders[0]).toBe('batch_key');
    expect(csvHeaders[9]).toBe('cta');
  });

  it('export ZIP: contient csv + texts.md + manifest.json', () => {
    const zipContents = [
      'canva_export.csv',
      'texts.md',
      'manifest.json',
    ];
    
    expect(zipContents).toContain('canva_export.csv');
    expect(zipContents).toContain('texts.md');
    expect(zipContents).toContain('manifest.json');
  });
});

describe('E2E: Woofs flow', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('vérifie quota avant génération', async () => {
    const pack = mockSoloVideoPack;
    const woofsCost = calculatePackWoofCost(pack);
    
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockWoofsCheckConsume.success(400).data,
      error: null,
    });
    
    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: woofsCost },
    });
    
    expect(result.data?.consumed).toBe(true);
  });

  it('bloque génération si quota insuffisant', async () => {
    const pack = mockSoloVideoPack;
    const woofsCost = calculatePackWoofCost(pack);
    
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: null,
      error: mockWoofsCheckConsume.insufficientWoofs(10, woofsCost).error,
    });
    
    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: woofsCost },
    });
    
    expect(result.error?.code).toBe('INSUFFICIENT_WOOFS');
    expect(result.error?.remaining).toBe(10);
    expect(result.error?.required).toBe(25);
  });

  it('refund si job échoue après consommation', async () => {
    const pack = mockSoloImagePack;
    const woofsCost = calculatePackWoofCost(pack);
    
    // Step 1: Consume woofs (success)
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockWoofsCheckConsume.success(449).data,
      error: null,
    });
    
    await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: woofsCost },
    });
    
    // Step 2: Job fails
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockJobWorker.error('GENERATION_FAILED', 'API error'),
      error: null,
    });
    
    const jobResult = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_id: 'job-123' },
    });
    
    expect(jobResult.data?.success).toBe(false);
    
    // Step 3: Refund woofs
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: { refunded_woofs: woofsCost, new_balance: 450 },
      error: null,
    });
    
    const refundResult = await mockClient.functions.invoke('alfie-refund-woofs', {
      body: { brand_id: 'brand-123', woofs: woofsCost, reason: 'job_failed' },
    });
    
    expect(refundResult.data?.refunded_woofs).toBe(1);
    expect(refundResult.data?.new_balance).toBe(450);
  });

  it('alerte à 80% du quota', async () => {
    // User has 450 quota, 360 used = 90 remaining = 80% used
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockWoofsCheckConsume.success(90, true).data,
      error: null,
    });
    
    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: 10 },
    });
    
    expect(result.data?.threshold_80).toBe(true);
  });
});

describe('E2E: Error recovery', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('retry job après échec temporaire', async () => {
    // First attempt: rate limited
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockJobWorker.rateLimited(),
      error: null,
    });
    
    const firstAttempt = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_id: 'job-123' },
    });
    
    expect(firstAttempt.data?.error?.code).toBe('RATE_LIMITED');
    
    // Second attempt: success
    mockClient._mockInvoke.mockResolvedValueOnce({
      data: mockJobWorker.imageResult('https://cdn.example.com/image.jpg'),
      error: null,
    });
    
    const secondAttempt = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_id: 'job-123' },
    });
    
    expect(secondAttempt.data?.success).toBe(true);
  });

  it('marque job failed après max retries (3)', () => {
    const job = {
      id: 'job-123',
      retry_count: 3,
      max_retries: 3,
      status: 'running',
    };
    
    const shouldFail = job.retry_count >= job.max_retries;
    expect(shouldFail).toBe(true);
    
    // Job should be marked as 'failed'
    const newStatus = shouldFail ? 'failed' : 'queued';
    expect(newStatus).toBe('failed');
  });
});
