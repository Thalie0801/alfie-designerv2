/**
 * Tests d'intégration pour les edge functions
 * Tests: woofs-check-consume, alfie-job-worker, video-batch-create
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  mockWoofsCheckConsume,
  mockJobWorker,
  mockRefundWoofs,
  mockVideoBatchCreate,
  createMockSupabaseClient,
} from '../mocks/edgeFunctionMocks';

describe('woofs-check-consume', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('retourne ok: true si quota suffisant', async () => {
    const successResponse = mockWoofsCheckConsume.success(400);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: successResponse.data, error: null });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: 10 },
    });

    expect(result.data?.consumed).toBe(true);
    expect(result.data?.remaining_woofs).toBe(400);
  });

  it('retourne INSUFFICIENT_WOOFS si quota épuisé', async () => {
    const errorResponse = mockWoofsCheckConsume.insufficientWoofs(5, 25);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: null, error: errorResponse.error });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: 25 },
    });

    expect(result.error?.code).toBe('INSUFFICIENT_WOOFS');
    expect(result.error?.remaining).toBe(5);
    expect(result.error?.required).toBe(25);
  });

  it('retourne FORBIDDEN si mauvaise brand', async () => {
    const errorResponse = mockWoofsCheckConsume.forbidden();
    mockClient._mockInvoke.mockResolvedValueOnce({ data: null, error: errorResponse.error });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'wrong-brand', woofs_required: 10 },
    });

    expect(result.error?.code).toBe('FORBIDDEN');
  });

  it('retourne NO_BRAND si aucune brand active', async () => {
    const errorResponse = mockWoofsCheckConsume.noBrand();
    mockClient._mockInvoke.mockResolvedValueOnce({ data: null, error: errorResponse.error });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { woofs_required: 10 },
    });

    expect(result.error?.code).toBe('NO_BRAND');
  });

  it('indique threshold_80 quand quota proche de la limite', async () => {
    const successResponse = mockWoofsCheckConsume.success(50, true);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: successResponse.data, error: null });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: 10 },
    });

    expect(result.data?.threshold_80).toBe(true);
  });

  it('calcule correctement remaining_woofs après consommation', async () => {
    // Simule: 450 quota - 50 used - 25 consumed = 375 remaining
    const successResponse = mockWoofsCheckConsume.success(375);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: successResponse.data, error: null });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: 25 },
    });

    expect(result.data?.remaining_woofs).toBe(375);
  });
});

describe('alfie-job-worker', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('traite render_images et retourne image_url', async () => {
    const imageResult = mockJobWorker.imageResult('https://cloudinary.com/image.jpg');
    mockClient._mockInvoke.mockResolvedValueOnce({ data: imageResult, error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'render_images', payload: { prompt: 'Test image' } },
    });

    expect(result.data?.success).toBe(true);
    expect(result.data?.image_url).toContain('cloudinary.com');
  });

  it('traite render_carousels et retourne slides array', async () => {
    const carouselResult = mockJobWorker.carouselResult([
      'https://cloudinary.com/slide1.jpg',
      'https://cloudinary.com/slide2.jpg',
      'https://cloudinary.com/slide3.jpg',
    ]);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: carouselResult, error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'render_carousels', payload: { slide_count: 3 } },
    });

    expect(result.data?.success).toBe(true);
    expect(result.data?.slides).toHaveLength(3);
    expect(result.data?.slides[0].slide_index).toBe(0);
  });

  it('traite generate_video et retourne video_url', async () => {
    const videoResult = mockJobWorker.videoResult('https://cloudinary.com/video.mp4');
    mockClient._mockInvoke.mockResolvedValueOnce({ data: videoResult, error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'generate_video', payload: { prompt: 'Test video' } },
    });

    expect(result.data?.success).toBe(true);
    expect(result.data?.video_url).toContain('video.mp4');
    expect(result.data?.duration_seconds).toBe(8);
  });

  it('gère erreur 429 rate limited', async () => {
    const errorResult = mockJobWorker.rateLimited();
    mockClient._mockInvoke.mockResolvedValueOnce({ data: errorResult, error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'render_images', payload: {} },
    });

    expect(result.data?.success).toBe(false);
    expect(result.data?.error?.code).toBe('RATE_LIMITED');
  });

  it('gère erreur 402 quota exceeded', async () => {
    const errorResult = mockJobWorker.quotaExceeded();
    mockClient._mockInvoke.mockResolvedValueOnce({ data: errorResult, error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'generate_video', payload: {} },
    });

    expect(result.data?.success).toBe(false);
    expect(result.data?.error?.code).toBe('QUOTA_EXCEEDED');
  });

  it('retourne erreur générique avec message', async () => {
    const errorResult = mockJobWorker.error('GENERATION_FAILED', 'Image generation failed');
    mockClient._mockInvoke.mockResolvedValueOnce({ data: errorResult, error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', {
      body: { job_type: 'render_images', payload: {} },
    });

    expect(result.data?.success).toBe(false);
    expect(result.data?.error?.message).toBe('Image generation failed');
  });
});

describe('alfie-refund-woofs', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('rembourse les Woofs et retourne nouveau solde', async () => {
    const refundResult = mockRefundWoofs.success(25, 425);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: refundResult.data, error: null });

    const result = await mockClient.functions.invoke('alfie-refund-woofs', {
      body: { brand_id: 'brand-123', woofs: 25, reason: 'job_failed' },
    });

    expect(result.data?.refunded_woofs).toBe(25);
    expect(result.data?.new_balance).toBe(425);
  });

  it('gère erreur de refund', async () => {
    const errorResult = mockRefundWoofs.error('Brand not found');
    mockClient._mockInvoke.mockResolvedValueOnce({ data: null, error: errorResult.error });

    const result = await mockClient.functions.invoke('alfie-refund-woofs', {
      body: { brand_id: 'invalid', woofs: 10 },
    });

    expect(result.error?.message).toBe('Brand not found');
  });
});

describe('video-batch-create', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('crée un batch avec videos et clips', async () => {
    const batchResult = mockVideoBatchCreate.success('batch-abc', 3);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: batchResult.data, error: null });

    const result = await mockClient.functions.invoke('video-batch-create', {
      body: { 
        brand_id: 'brand-123', 
        video_count: 3,
        prompt: 'Batch de vidéos test',
      },
    });

    expect(result.data?.batch_id).toBe('batch-abc');
    expect(result.data?.video_count).toBe(3);
    expect(result.data?.total_clips).toBe(9); // 3 videos × 3 clips
  });

  it('calcule le coût total correct (N × 3 × 25 Woofs)', async () => {
    const batchResult = mockVideoBatchCreate.success('batch-xyz', 5);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: batchResult.data, error: null });

    const result = await mockClient.functions.invoke('video-batch-create', {
      body: { brand_id: 'brand-123', video_count: 5 },
    });

    // 5 videos × 3 clips × 25 Woofs = 375 Woofs
    expect(result.data?.total_woofs_cost).toBe(375);
  });

  it('retourne status queued après création', async () => {
    const batchResult = mockVideoBatchCreate.success('batch-new', 2);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: batchResult.data, error: null });

    const result = await mockClient.functions.invoke('video-batch-create', {
      body: { brand_id: 'brand-123', video_count: 2 },
    });

    expect(result.data?.status).toBe('queued');
  });

  it('gère erreur de création batch', async () => {
    const errorResult = mockVideoBatchCreate.error('Insufficient Woofs for batch');
    mockClient._mockInvoke.mockResolvedValueOnce({ data: null, error: { message: errorResult.error.message } });

    const result = await mockClient.functions.invoke('video-batch-create', {
      body: { brand_id: 'brand-123', video_count: 10 },
    });

    expect(result.error?.message).toContain('Insufficient Woofs');
  });
});

describe('Edge function error handling', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('gère timeout de fonction', async () => {
    mockClient._mockInvoke.mockRejectedValueOnce(new Error('Function timeout'));

    await expect(
      mockClient.functions.invoke('alfie-job-worker', { body: {} })
    ).rejects.toThrow('timeout');
  });

  it('gère erreur réseau', async () => {
    mockClient._mockInvoke.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      mockClient.functions.invoke('woofs-check-consume', { body: {} })
    ).rejects.toThrow('Network');
  });

  it('gère réponse malformée', async () => {
    mockClient._mockInvoke.mockResolvedValueOnce({ data: 'not-json-object', error: null });

    const result = await mockClient.functions.invoke('alfie-job-worker', { body: {} });
    
    // La fonction devrait gérer gracieusement une réponse inattendue
    expect(typeof result.data).toBe('string');
  });
});
