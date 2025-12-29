/**
 * Mocks pour simuler les réponses des edge functions
 */

import { vi } from 'vitest';

// Mock woofs-check-consume responses
export const mockWoofsCheckConsume = {
  success: (remaining: number, threshold80 = false) => ({
    ok: true,
    data: {
      remaining_woofs: remaining,
      threshold_80: threshold80,
      consumed: true,
    },
  }),
  insufficientWoofs: (remaining: number, required: number) => ({
    ok: false,
    error: {
      code: 'INSUFFICIENT_WOOFS',
      message: `Woofs insuffisants : ${remaining} restants, ${required} requis`,
      remaining,
      required,
    },
  }),
  forbidden: () => ({
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Accès refusé à cette brand',
    },
  }),
  noBrand: () => ({
    ok: false,
    error: {
      code: 'NO_BRAND',
      message: 'Aucune brand active trouvée',
    },
  }),
};

// Mock alfie-job-worker responses
export const mockJobWorker = {
  imageResult: (url: string, publicId?: string) => ({
    success: true,
    image_url: url,
    public_id: publicId || 'alfie/image_123',
    width: 1080,
    height: 1080,
  }),
  carouselResult: (slideUrls: string[]) => ({
    success: true,
    slides: slideUrls.map((url, i) => ({
      url,
      public_id: `alfie/carousel_slide_${i}`,
      slide_index: i,
    })),
  }),
  videoResult: (videoUrl: string, thumbnailUrl?: string) => ({
    success: true,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl || videoUrl.replace('.mp4', '_thumb.jpg'),
    duration_seconds: 8,
    provider_id: 'veo_3_1_operation_123',
  }),
  error: (code: string, message: string) => ({
    success: false,
    error: { code, message },
  }),
  rateLimited: () => ({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Trop de requêtes, réessayez plus tard' },
  }),
  quotaExceeded: () => ({
    success: false,
    error: { code: 'QUOTA_EXCEEDED', message: 'Quota API épuisé' },
  }),
};

// Mock alfie-refund-woofs responses
export const mockRefundWoofs = {
  success: (refunded: number, newBalance: number) => ({
    ok: true,
    data: {
      refunded_woofs: refunded,
      new_balance: newBalance,
    },
  }),
  error: (message: string) => ({
    ok: false,
    error: { message },
  }),
};

// Mock video-batch-create responses
export const mockVideoBatchCreate = {
  success: (batchId: string, videoCount: number) => ({
    success: true,
    data: {
      batch_id: batchId,
      video_count: videoCount,
      total_clips: videoCount * 3,
      total_woofs_cost: videoCount * 3 * 25,
      status: 'queued',
    },
  }),
  error: (message: string) => ({
    success: false,
    error: { message },
  }),
};

// Mock Supabase functions.invoke
export const createMockFunctionsInvoke = () => {
  return vi.fn().mockImplementation((fnName: string, options?: { body?: any }) => {
    const body = options?.body || {};
    
    switch (fnName) {
      case 'woofs-check-consume':
        // Default: success with 400 remaining
        return Promise.resolve({ data: mockWoofsCheckConsume.success(400).data, error: null });
      
      case 'alfie-job-worker':
        // Default: success based on job type
        return Promise.resolve({ data: { processed: true }, error: null });
      
      case 'alfie-refund-woofs':
        return Promise.resolve({ data: mockRefundWoofs.success(body.woofs || 10, 450).data, error: null });
      
      case 'video-batch-create':
        return Promise.resolve({ 
          data: mockVideoBatchCreate.success('batch-123', body.video_count || 3).data, 
          error: null 
        });
      
      default:
        return Promise.resolve({ data: null, error: { message: `Unknown function: ${fnName}` } });
    }
  });
};

// Helper to create mock Supabase client for tests
export const createMockSupabaseClient = () => {
  const mockInvoke = createMockFunctionsInvoke();
  
  return {
    functions: {
      invoke: mockInvoke,
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: { id: 'user-123', email: 'test@example.com' } }, 
        error: null 
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
    },
    // Helper to configure specific mock responses
    _mockInvoke: mockInvoke,
  };
};
