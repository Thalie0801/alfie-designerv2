/**
 * Tests pour la génération de carrousels
 * Scénarios: solo, multiples, modes standard/background, citations
 */

import { describe, it, expect } from 'vitest';
import { 
  mockSoloCarouselPack, 
  mockMultiCarouselPack,
  createCarouselAsset,
} from '../mocks/packMocks';
import { calculatePackWoofCost } from '@/lib/woofs';

describe('Carrousel - Structure de base', () => {
  it('un carrousel solo a 5 slides par défaut', () => {
    const pack = mockSoloCarouselPack;
    expect(pack.assets).toHaveLength(1);
    expect(pack.assets[0].count).toBe(5);
  });

  it('un carrousel a le kind "carousel"', () => {
    const asset = createCarouselAsset();
    expect(asset.kind).toBe('carousel');
  });

  it('un carrousel a le woofCostType "carousel"', () => {
    const asset = createCarouselAsset();
    expect(asset.woofCostType).toBe('carousel');
  });
});

describe('Carrousel - Modes de génération', () => {
  it('mode standard inclut les textes générés', () => {
    const asset = createCarouselAsset({ carouselType: 'content' });
    expect(asset.generatedTexts?.slides).toBeDefined();
    expect(asset.generatedTexts?.slides).toHaveLength(5);
  });

  it('mode citations inclut le champ author dans les slides', () => {
    const asset = createCarouselAsset({
      carouselType: 'citations',
      generatedTexts: {
        slides: [
          { title: 'Citation 1', subtitle: 'Le succès...', author: 'Steve Jobs' },
          { title: 'Citation 2', subtitle: 'Think different...', author: 'Apple' },
          { title: 'Citation 3', subtitle: 'Stay hungry...', author: 'Stanford 2005' },
        ],
      },
    });
    expect(asset.carouselType).toBe('citations');
    expect(asset.generatedTexts?.slides?.[0].author).toBeDefined();
  });

  it('mode background_only peut ne pas avoir de textes', () => {
    const asset = createCarouselAsset({
      generatedTexts: undefined,
    });
    expect(asset.generatedTexts).toBeUndefined();
  });
});

describe('Carrousel - Nombre de slides variable', () => {
  const slideCounts = [3, 5, 7, 10];

  slideCounts.forEach(slideCount => {
    it(`carrousel avec ${slideCount} slides est valide`, () => {
      const asset = createCarouselAsset({
        count: slideCount,
        generatedTexts: {
          slides: Array.from({ length: slideCount }, (_, i) => ({
            title: `Slide ${i + 1}`,
            subtitle: `Contenu ${i + 1}`,
          })),
        },
      });
      expect(asset.count).toBe(slideCount);
      expect(asset.generatedTexts?.slides).toHaveLength(slideCount);
    });
  });
});

describe('Carrousel - Packs multiples', () => {
  it('3 carrousels = 3 assets distincts', () => {
    const pack = mockMultiCarouselPack(3);
    expect(pack.assets).toHaveLength(3);
    pack.assets.forEach(asset => {
      expect(asset.kind).toBe('carousel');
    });
  });

  it('5 carrousels = 5 assets distincts', () => {
    const pack = mockMultiCarouselPack(5);
    expect(pack.assets).toHaveLength(5);
  });

  it('chaque carrousel a un ID unique', () => {
    const pack = mockMultiCarouselPack(3);
    const ids = pack.assets.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });
});

describe('Carrousel - Coûts Woofs', () => {
  it('1 carrousel = 10 Woofs (coût fixe)', () => {
    const cost = calculatePackWoofCost(mockSoloCarouselPack);
    expect(cost).toBe(10);
  });

  it('3 carrousels = 30 Woofs', () => {
    const cost = calculatePackWoofCost(mockMultiCarouselPack(3));
    expect(cost).toBe(30);
  });

  it('5 carrousels = 50 Woofs', () => {
    const cost = calculatePackWoofCost(mockMultiCarouselPack(5));
    expect(cost).toBe(50);
  });

  it('le nombre de slides ne change pas le coût', () => {
    const carousel3Slides = createCarouselAsset({ count: 3 });
    const carousel10Slides = createCarouselAsset({ count: 10 });
    
    const pack3 = { title: 'Test', summary: '', assets: [carousel3Slides] };
    const pack10 = { title: 'Test', summary: '', assets: [carousel10Slides] };
    
    expect(calculatePackWoofCost(pack3)).toBe(10);
    expect(calculatePackWoofCost(pack10)).toBe(10);
  });
});

describe('Carrousel - Ratios par plateforme', () => {
  const platformRatios = [
    { platform: 'instagram', expectedRatio: '4:5' },
    { platform: 'linkedin', expectedRatio: '1:1' },
    { platform: 'pinterest', expectedRatio: '2:3' },
  ] as const;

  platformRatios.forEach(({ platform, expectedRatio }) => {
    it(`carrousel ${platform} suggère ratio ${expectedRatio}`, () => {
      const asset = createCarouselAsset({ 
        platform, 
        ratio: expectedRatio,
      });
      expect(asset.ratio).toBe(expectedRatio);
    });
  });
});

describe('Carrousel - Visual Style', () => {
  it('carrousel peut avoir visualStyleCategory background', () => {
    const asset = createCarouselAsset({ visualStyleCategory: 'background' });
    expect(asset.visualStyleCategory).toBe('background');
  });

  it('carrousel peut avoir visualStyleCategory character', () => {
    const asset = createCarouselAsset({ visualStyleCategory: 'character' });
    expect(asset.visualStyleCategory).toBe('character');
  });

  it('carrousel peut avoir visualStyleCategory product', () => {
    const asset = createCarouselAsset({ visualStyleCategory: 'product' });
    expect(asset.visualStyleCategory).toBe('product');
  });
});

describe('Carrousel - Brand Kit', () => {
  it('carrousel peut avoir useBrandKit = true', () => {
    const asset = createCarouselAsset({ useBrandKit: true });
    expect(asset.useBrandKit).toBe(true);
  });

  it('carrousel peut avoir useBrandKit = false', () => {
    const asset = createCarouselAsset({ useBrandKit: false });
    expect(asset.useBrandKit).toBe(false);
  });
});
