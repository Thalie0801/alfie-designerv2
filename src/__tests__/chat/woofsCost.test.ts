/**
 * Tests pour le calcul des coûts en Woofs
 */

import { describe, it, expect } from 'vitest';
import { calculatePackWoofCost, WOOF_COSTS, getWoofCost } from '@/lib/woofs';
import { 
  mockSoloImagePack, 
  mockMultiImagePack, 
  mockSoloCarouselPack,
  mockMultiCarouselPack,
  mockSoloVideoPack,
  mockMultiVideoPack,
  mockMixedPack,
  createImageAsset,
  createCarouselAsset,
  createVideoAsset,
} from '../mocks/packMocks';

describe('WOOF_COSTS constants', () => {
  it('image coûte 1 Woof', () => {
    expect(WOOF_COSTS.image).toBe(1);
  });

  it('carrousel coûte 10 Woofs (fixe)', () => {
    expect(WOOF_COSTS.carousel).toBe(10);
  });

  it('vidéo premium coûte 25 Woofs', () => {
    expect(WOOF_COSTS.video_premium).toBe(25);
  });
});

describe('getWoofCost', () => {
  it('retourne 1 pour une image', () => {
    expect(getWoofCost('image')).toBe(1);
  });

  it('retourne 10 pour un carrousel', () => {
    expect(getWoofCost('carousel')).toBe(10);
  });

  it('retourne 25 pour une vidéo premium', () => {
    expect(getWoofCost('video_premium')).toBe(25);
  });
});

describe('calculatePackWoofCost - Images', () => {
  it('calcule le coût d\'une seule image (1 Woof)', () => {
    const pack = mockSoloImagePack;
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(1);
  });

  it('calcule le coût de 5 images (5 Woofs)', () => {
    const pack = mockMultiImagePack(5);
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(5);
  });

  it('calcule le coût de 10 images (10 Woofs)', () => {
    const pack = mockMultiImagePack(10);
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(10);
  });

  it('calcule le coût avec sélection partielle', () => {
    const pack = mockMultiImagePack(5);
    const selectedIds = [pack.assets[0].id, pack.assets[1].id]; // 2 images
    const cost = calculatePackWoofCost(pack, selectedIds);
    expect(cost).toBe(2);
  });
});

describe('calculatePackWoofCost - Carrousels', () => {
  it('calcule le coût d\'un seul carrousel (10 Woofs fixe)', () => {
    const pack = mockSoloCarouselPack;
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(10);
  });

  it('calcule le coût de 3 carrousels (30 Woofs)', () => {
    const pack = mockMultiCarouselPack(3);
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(30);
  });

  it('calcule le coût de 5 carrousels (50 Woofs)', () => {
    const pack = mockMultiCarouselPack(5);
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(50);
  });

  it('le nombre de slides ne change pas le coût (fixe à 10)', () => {
    // Carrousel avec 10 slides = toujours 10 Woofs
    const pack = {
      title: 'Test',
      summary: 'Test',
      assets: [createCarouselAsset({ count: 10 })],
    };
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(10); // Toujours 10, pas 10 * slides
  });
});

describe('calculatePackWoofCost - Vidéos', () => {
  it('calcule le coût d\'une seule vidéo (25 Woofs)', () => {
    const pack = mockSoloVideoPack;
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(25);
  });

  it('calcule le coût de 3 clips vidéo (75 Woofs)', () => {
    const pack = mockMultiVideoPack(3);
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(75);
  });

  it('calcule le coût de 4 scènes script (100 Woofs)', () => {
    const pack = mockMultiVideoPack(4);
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(100);
  });
});

describe('calculatePackWoofCost - Packs mixtes', () => {
  it('calcule le coût d\'un pack mixte (2 images + 1 carrousel + 1 vidéo = 37 Woofs)', () => {
    const cost = calculatePackWoofCost(mockMixedPack);
    // 2 × 1 (images) + 1 × 10 (carrousel) + 1 × 25 (vidéo) = 37
    expect(cost).toBe(37);
  });

  it('calcule le coût avec sélection partielle sur pack mixte', () => {
    const pack = mockMixedPack;
    // Sélectionner seulement les 2 images
    const imageIds = pack.assets.filter(a => a.kind === 'image').map(a => a.id);
    const cost = calculatePackWoofCost(pack, imageIds);
    expect(cost).toBe(2);
  });

  it('calcule le coût complexe: 5 images + 3 carrousels + 2 vidéos = 85 Woofs', () => {
    const pack = {
      title: 'Pack Complexe',
      summary: 'Test complexe',
      assets: [
        ...Array.from({ length: 5 }, () => createImageAsset()),
        ...Array.from({ length: 3 }, () => createCarouselAsset()),
        ...Array.from({ length: 2 }, () => createVideoAsset()),
      ],
    };
    const cost = calculatePackWoofCost(pack);
    // 5 × 1 + 3 × 10 + 2 × 25 = 5 + 30 + 50 = 85
    expect(cost).toBe(85);
  });
});

describe('Edge cases', () => {
  it('retourne 0 pour un pack vide', () => {
    const pack = { title: 'Empty', summary: '', assets: [] };
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(0);
  });

  it('retourne 0 si aucun asset sélectionné', () => {
    const pack = mockMixedPack;
    const cost = calculatePackWoofCost(pack, []);
    expect(cost).toBe(0);
  });

  it('gère les IDs de sélection inexistants', () => {
    const pack = mockSoloImagePack;
    const cost = calculatePackWoofCost(pack, ['non-existent-id']);
    expect(cost).toBe(0);
  });
});
