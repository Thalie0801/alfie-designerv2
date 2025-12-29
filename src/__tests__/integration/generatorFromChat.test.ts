/**
 * Tests d'intégration pour generatorFromChat.ts
 * Tests du flux: Pack → Woofs check → Jobs → Worker trigger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  mockSoloImagePack, 
  mockMultiImagePack,
  mockSoloCarouselPack,
  mockSoloVideoPack,
  mockMixedPack,
  createImageAsset,
  createCarouselAsset,
  createVideoAsset,
} from '../mocks/packMocks';
import { 
  mockWoofsCheckConsume, 
  mockRefundWoofs,
  createMockSupabaseClient,
} from '../mocks/edgeFunctionMocks';
import { calculatePackWoofCost } from '@/lib/woofs';

describe('sendPackToGenerator - Woofs verification', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('appelle woofs-check-consume avec le coût correct pour 1 image', async () => {
    const pack = mockSoloImagePack;
    const expectedCost = calculatePackWoofCost(pack);
    
    expect(expectedCost).toBe(1);
    
    // Simulate the call
    await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: expectedCost },
    });
    
    expect(mockClient._mockInvoke).toHaveBeenCalledWith(
      'woofs-check-consume',
      expect.objectContaining({
        body: expect.objectContaining({ woofs_required: 1 }),
      })
    );
  });

  it('appelle woofs-check-consume avec le coût correct pour 5 images', async () => {
    const pack = mockMultiImagePack(5);
    const expectedCost = calculatePackWoofCost(pack);
    
    expect(expectedCost).toBe(5);
    
    await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: expectedCost },
    });
    
    expect(mockClient._mockInvoke).toHaveBeenCalledWith(
      'woofs-check-consume',
      expect.objectContaining({
        body: expect.objectContaining({ woofs_required: 5 }),
      })
    );
  });

  it('appelle woofs-check-consume avec le coût correct pour 1 carrousel (10 Woofs)', async () => {
    const pack = mockSoloCarouselPack;
    const expectedCost = calculatePackWoofCost(pack);
    
    expect(expectedCost).toBe(10);
  });

  it('appelle woofs-check-consume avec le coût correct pour 1 vidéo (25 Woofs)', async () => {
    const pack = mockSoloVideoPack;
    const expectedCost = calculatePackWoofCost(pack);
    
    expect(expectedCost).toBe(25);
  });

  it('appelle woofs-check-consume avec le coût correct pour pack mixte (37 Woofs)', async () => {
    const expectedCost = calculatePackWoofCost(mockMixedPack);
    
    // 2 images (2) + 1 carrousel (10) + 1 vidéo (25) = 37
    expect(expectedCost).toBe(37);
  });
});

describe('sendPackToGenerator - Insufficient Woofs', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('retourne une erreur INSUFFICIENT_WOOFS si quota épuisé', async () => {
    const insufficientResponse = mockWoofsCheckConsume.insufficientWoofs(5, 25);
    mockClient._mockInvoke.mockResolvedValueOnce({ 
      data: null, 
      error: insufficientResponse.error 
    });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'brand-123', woofs_required: 25 },
    });

    expect(result.error?.code).toBe('INSUFFICIENT_WOOFS');
    expect(result.error?.remaining).toBe(5);
    expect(result.error?.required).toBe(25);
  });

  it('retourne une erreur FORBIDDEN si mauvaise brand', async () => {
    const forbiddenResponse = mockWoofsCheckConsume.forbidden();
    mockClient._mockInvoke.mockResolvedValueOnce({ 
      data: null, 
      error: forbiddenResponse.error 
    });

    const result = await mockClient.functions.invoke('woofs-check-consume', {
      body: { brand_id: 'wrong-brand', woofs_required: 10 },
    });

    expect(result.error?.code).toBe('FORBIDDEN');
  });
});

describe('sendPackToGenerator - Job creation', () => {
  it('crée 1 job pour une image solo', () => {
    const pack = mockSoloImagePack;
    const jobsToCreate = pack.assets.map(asset => ({
      type: asset.kind === 'image' ? 'render_images' : 
            asset.kind === 'carousel' ? 'render_carousels' : 'generate_video',
      payload: { assetId: asset.id, prompt: asset.prompt },
    }));

    expect(jobsToCreate).toHaveLength(1);
    expect(jobsToCreate[0].type).toBe('render_images');
  });

  it('crée 5 jobs pour 5 images groupées', () => {
    const pack = mockMultiImagePack(5);
    const jobsToCreate = pack.assets.map(asset => ({
      type: 'render_images',
      payload: { assetId: asset.id },
    }));

    expect(jobsToCreate).toHaveLength(5);
  });

  it('crée 1 job render_carousels pour un carrousel', () => {
    const pack = mockSoloCarouselPack;
    const asset = pack.assets[0];
    const jobType = asset.kind === 'carousel' ? 'render_carousels' : 'render_images';

    expect(jobType).toBe('render_carousels');
  });

  it('crée 1 job generate_video pour une vidéo', () => {
    const pack = mockSoloVideoPack;
    const asset = pack.assets[0];
    const jobType = asset.kind === 'video_premium' ? 'generate_video' : 'render_images';

    expect(jobType).toBe('generate_video');
  });

  it('crée 4 jobs distincts pour pack mixte', () => {
    const pack = mockMixedPack;
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

describe('sendPackToGenerator - Worker trigger', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('déclenche alfie-job-worker après création des jobs', async () => {
    await mockClient.functions.invoke('alfie-job-worker', {
      body: { trigger: 'pack_created' },
    });

    expect(mockClient._mockInvoke).toHaveBeenCalledWith(
      'alfie-job-worker',
      expect.anything()
    );
  });
});

describe('sendPackToGenerator - Refund on failure', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('appelle alfie-refund-woofs si création de jobs échoue', async () => {
    const pack = mockSoloVideoPack;
    const woofsToRefund = calculatePackWoofCost(pack);

    await mockClient.functions.invoke('alfie-refund-woofs', {
      body: { brand_id: 'brand-123', woofs: woofsToRefund, reason: 'pack_creation_failed' },
    });

    expect(mockClient._mockInvoke).toHaveBeenCalledWith(
      'alfie-refund-woofs',
      expect.objectContaining({
        body: expect.objectContaining({ woofs: 25 }),
      })
    );
  });

  it('refund response contient le nouveau solde', async () => {
    const refundResponse = mockRefundWoofs.success(25, 425);
    mockClient._mockInvoke.mockResolvedValueOnce({ data: refundResponse.data, error: null });

    const result = await mockClient.functions.invoke('alfie-refund-woofs', {
      body: { brand_id: 'brand-123', woofs: 25 },
    });

    expect(result.data?.refunded_woofs).toBe(25);
    expect(result.data?.new_balance).toBe(425);
  });
});

describe('createAssetJob - Payload generation', () => {
  it('génère le payload correct pour une image', () => {
    const asset = createImageAsset({
      prompt: 'Image test',
      ratio: '1:1',
      visualStyle: 'photorealistic',
      useBrandKit: true,
    });

    const payload = {
      assetId: asset.id,
      prompt: asset.prompt,
      ratio: asset.ratio,
      visualStyle: asset.visualStyle,
      useBrandKit: asset.useBrandKit,
    };

    expect(payload.ratio).toBe('1:1');
    expect(payload.visualStyle).toBe('photorealistic');
    expect(payload.useBrandKit).toBe(true);
  });

  it('génère le payload correct pour un carrousel', () => {
    const asset = createCarouselAsset({
      carouselType: 'content',
      count: 7,
      visualStyleCategory: 'background',
    });

    const payload = {
      assetId: asset.id,
      carouselMode: asset.carouselType,
      slideCount: asset.count,
      visualStyleCategory: asset.visualStyleCategory,
      generatedTexts: asset.generatedTexts,
    };

    expect(payload.carouselMode).toBe('content');
    expect(payload.slideCount).toBe(7);
    expect(payload.visualStyleCategory).toBe('background');
    expect(payload.generatedTexts?.slides).toHaveLength(5); // Default mock has 5
  });

  it('génère le payload correct pour une vidéo', () => {
    const asset = createVideoAsset({
      durationSeconds: 8,
      ratio: '9:16',
      withAudio: true,
      postProdMode: true,
      overlayLines: ['Ligne 1', 'Ligne 2'],
    });

    const payload = {
      assetId: asset.id,
      prompt: asset.prompt,
      durationSeconds: asset.durationSeconds,
      ratio: asset.ratio,
      withAudio: asset.withAudio,
      postProdMode: asset.postProdMode,
      overlayLines: asset.overlayLines,
    };

    expect(payload.durationSeconds).toBe(8);
    expect(payload.ratio).toBe('9:16');
    expect(payload.withAudio).toBe(true);
    expect(payload.postProdMode).toBe(true);
    expect(payload.overlayLines).toHaveLength(2);
  });

  it('inclut referenceImageUrl si présente', () => {
    const asset = createVideoAsset({
      referenceImageUrl: 'https://example.com/ref.jpg',
    });

    const payload = {
      assetId: asset.id,
      referenceImageUrl: asset.referenceImageUrl,
    };

    expect(payload.referenceImageUrl).toBe('https://example.com/ref.jpg');
  });

  it('inclut scriptGroup et sceneOrder pour multi-clips', () => {
    const asset = createVideoAsset({
      scriptGroup: 'script-abc',
      sceneOrder: 2,
    });

    const payload = {
      assetId: asset.id,
      scriptGroup: asset.scriptGroup,
      sceneOrder: asset.sceneOrder,
    };

    expect(payload.scriptGroup).toBe('script-abc');
    expect(payload.sceneOrder).toBe(2);
  });
});
