/**
 * Tests pour la génération d'images
 * Scénarios: solo, groupées, ratios, brand kit ON/OFF
 */

import { describe, it, expect } from 'vitest';
import { 
  mockSoloImagePack, 
  mockMultiImagePack,
  createImageAsset,
} from '../mocks/packMocks';
import { calculatePackWoofCost } from '@/lib/woofs';

describe('Image - Structure de base', () => {
  it('une image solo a le kind "image"', () => {
    const asset = createImageAsset();
    expect(asset.kind).toBe('image');
  });

  it('une image a le woofCostType "image"', () => {
    const asset = createImageAsset();
    expect(asset.woofCostType).toBe('image');
  });

  it('une image a count = 1 par défaut', () => {
    const asset = createImageAsset();
    expect(asset.count).toBe(1);
  });
});

describe('Image - Pack solo', () => {
  it('pack solo contient 1 seul asset', () => {
    expect(mockSoloImagePack.assets).toHaveLength(1);
  });

  it('pack solo coûte 1 Woof', () => {
    const cost = calculatePackWoofCost(mockSoloImagePack);
    expect(cost).toBe(1);
  });
});

describe('Image - Packs groupés', () => {
  const imageCounts = [2, 3, 5, 10];

  imageCounts.forEach(count => {
    it(`${count} images = ${count} assets`, () => {
      const pack = mockMultiImagePack(count);
      expect(pack.assets).toHaveLength(count);
    });

    it(`${count} images = ${count} Woofs`, () => {
      const pack = mockMultiImagePack(count);
      const cost = calculatePackWoofCost(pack);
      expect(cost).toBe(count);
    });
  });

  it('images groupées partagent un coherenceGroup', () => {
    const pack = mockMultiImagePack(5);
    const groups = pack.assets.map(a => a.coherenceGroup);
    expect(new Set(groups).size).toBe(1); // Tous le même groupe
  });

  it('chaque image a un ID unique', () => {
    const pack = mockMultiImagePack(5);
    const ids = pack.assets.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });
});

describe('Image - Ratios', () => {
  const ratios = ['1:1', '4:5', '9:16', '16:9', '2:3'] as const;

  ratios.forEach(ratio => {
    it(`image ratio ${ratio} est valide`, () => {
      const asset = createImageAsset({ ratio });
      expect(asset.ratio).toBe(ratio);
    });
  });

  it('ratio 1:1 est carré (Instagram post)', () => {
    const asset = createImageAsset({ ratio: '1:1', platform: 'instagram' });
    expect(asset.ratio).toBe('1:1');
  });

  it('ratio 4:5 est portrait (Instagram feed)', () => {
    const asset = createImageAsset({ ratio: '4:5', platform: 'instagram' });
    expect(asset.ratio).toBe('4:5');
  });

  it('ratio 9:16 est vertical (Stories/Reels)', () => {
    const asset = createImageAsset({ ratio: '9:16', platform: 'instagram' });
    expect(asset.ratio).toBe('9:16');
  });

  it('ratio 16:9 est paysage (YouTube/LinkedIn)', () => {
    const asset = createImageAsset({ ratio: '16:9', platform: 'linkedin' });
    expect(asset.ratio).toBe('16:9');
  });

  it('ratio 2:3 est Pinterest', () => {
    const asset = createImageAsset({ ratio: '2:3', platform: 'pinterest' });
    expect(asset.ratio).toBe('2:3');
  });
});

describe('Image - Brand Kit', () => {
  it('image avec useBrandKit = true', () => {
    const asset = createImageAsset({ useBrandKit: true });
    expect(asset.useBrandKit).toBe(true);
  });

  it('image avec useBrandKit = false', () => {
    const asset = createImageAsset({ useBrandKit: false });
    expect(asset.useBrandKit).toBe(false);
  });

  it('useBrandKit undefined par défaut (respecte le toggle UI)', () => {
    const asset = createImageAsset();
    expect(asset.useBrandKit).toBeUndefined();
  });
});

describe('Image - Visual Styles', () => {
  const styles = [
    'photorealistic',
    'cinematic_photorealistic',
    '3d_pixar_style',
    'flat_illustration',
    'minimalist_vector',
    'digital_painting',
    'comic_book',
  ] as const;

  styles.forEach(style => {
    it(`style ${style} est valide`, () => {
      const asset = createImageAsset({ visualStyle: style });
      expect(asset.visualStyle).toBe(style);
    });
  });
});

describe('Image - Visual Style Categories', () => {
  const categories = ['background', 'character', 'product'] as const;

  categories.forEach(category => {
    it(`category ${category} est valide`, () => {
      const asset = createImageAsset({ visualStyleCategory: category });
      expect(asset.visualStyleCategory).toBe(category);
    });
  });
});

describe('Image - Plateformes', () => {
  const platforms = ['instagram', 'linkedin', 'tiktok', 'youtube', 'facebook', 'pinterest', 'generic'] as const;

  platforms.forEach(platform => {
    it(`plateforme ${platform} est valide`, () => {
      const asset = createImageAsset({ platform });
      expect(asset.platform).toBe(platform);
    });
  });
});

describe('Image - Goals', () => {
  const goals = ['education', 'vente', 'lead', 'engagement', 'notoriete'] as const;

  goals.forEach(goal => {
    it(`goal ${goal} est valide`, () => {
      const asset = createImageAsset({ goal });
      expect(asset.goal).toBe(goal);
    });
  });
});

describe('Image - Sélection partielle', () => {
  it('sélection 2 images sur 5 = 2 Woofs', () => {
    const pack = mockMultiImagePack(5);
    const selectedIds = [pack.assets[0].id, pack.assets[1].id];
    const cost = calculatePackWoofCost(pack, selectedIds);
    expect(cost).toBe(2);
  });

  it('sélection 1 image sur 10 = 1 Woof', () => {
    const pack = mockMultiImagePack(10);
    const selectedIds = [pack.assets[0].id];
    const cost = calculatePackWoofCost(pack, selectedIds);
    expect(cost).toBe(1);
  });
});
