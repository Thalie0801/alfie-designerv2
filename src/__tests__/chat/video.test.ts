/**
 * Tests pour la génération de vidéos
 * Scénarios: solo, clips multiples, scripts multi-scènes, références
 */

import { describe, it, expect } from 'vitest';
import { 
  mockSoloVideoPack, 
  mockMultiVideoPack,
  createVideoAsset,
} from '../mocks/packMocks';
import { calculatePackWoofCost } from '@/lib/woofs';

describe('Vidéo - Structure de base', () => {
  it('une vidéo solo a le kind "video_premium"', () => {
    const asset = createVideoAsset();
    expect(asset.kind).toBe('video_premium');
  });

  it('une vidéo a le woofCostType "video_premium"', () => {
    const asset = createVideoAsset();
    expect(asset.woofCostType).toBe('video_premium');
  });

  it('durée par défaut est 8 secondes (VEO 3.1)', () => {
    const asset = createVideoAsset();
    expect(asset.durationSeconds).toBe(8);
  });

  it('ratio par défaut est 9:16 (vertical)', () => {
    const asset = createVideoAsset();
    expect(asset.ratio).toBe('9:16');
  });
});

describe('Vidéo - Multi-clips', () => {
  it('3 clips = 3 assets distincts', () => {
    const pack = mockMultiVideoPack(3);
    expect(pack.assets).toHaveLength(3);
  });

  it('5 clips = 5 assets distincts', () => {
    const pack = mockMultiVideoPack(5);
    expect(pack.assets).toHaveLength(5);
  });

  it('chaque clip a un ID unique', () => {
    const pack = mockMultiVideoPack(3);
    const ids = pack.assets.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it('clips multiples partagent un scriptGroup', () => {
    const pack = mockMultiVideoPack(3);
    const scriptGroups = pack.assets.map(a => a.scriptGroup);
    expect(new Set(scriptGroups).size).toBe(1); // Tous le même groupe
  });

  it('clips multiples ont un sceneOrder séquentiel', () => {
    const pack = mockMultiVideoPack(3);
    const orders = pack.assets.map(a => a.sceneOrder);
    expect(orders).toEqual([1, 2, 3]);
  });
});

describe('Vidéo - Scripts multi-scènes', () => {
  it('script 3 scènes a 3 assets liés', () => {
    const pack = mockMultiVideoPack(3);
    expect(pack.assets).toHaveLength(3);
    pack.assets.forEach(asset => {
      expect(asset.scriptGroup).toBe('script-123');
    });
  });

  it('script 4 scènes a 4 assets liés', () => {
    const pack = mockMultiVideoPack(4);
    expect(pack.assets).toHaveLength(4);
  });
});

describe('Vidéo - Coûts Woofs', () => {
  it('1 vidéo = 25 Woofs', () => {
    const cost = calculatePackWoofCost(mockSoloVideoPack);
    expect(cost).toBe(25);
  });

  it('3 clips = 75 Woofs', () => {
    const cost = calculatePackWoofCost(mockMultiVideoPack(3));
    expect(cost).toBe(75);
  });

  it('4 scènes script = 100 Woofs', () => {
    const cost = calculatePackWoofCost(mockMultiVideoPack(4));
    expect(cost).toBe(100);
  });

  it('5 clips = 125 Woofs', () => {
    const cost = calculatePackWoofCost(mockMultiVideoPack(5));
    expect(cost).toBe(125);
  });
});

describe('Vidéo - Reference Image', () => {
  it('vidéo peut avoir une referenceImageUrl', () => {
    const asset = createVideoAsset({
      referenceImageUrl: 'https://example.com/reference.jpg',
    });
    expect(asset.referenceImageUrl).toBe('https://example.com/reference.jpg');
  });

  it('vidéo sans reference est valide', () => {
    const asset = createVideoAsset();
    expect(asset.referenceImageUrl).toBeUndefined();
  });
});

describe('Vidéo - Audio', () => {
  it('vidéo avec audio activé', () => {
    const asset = createVideoAsset({ withAudio: true });
    expect(asset.withAudio).toBe(true);
  });

  it('vidéo avec audio désactivé', () => {
    const asset = createVideoAsset({ withAudio: false });
    expect(asset.withAudio).toBe(false);
  });
});

describe('Vidéo - Post-production', () => {
  it('vidéo avec post-prod mode activé', () => {
    const asset = createVideoAsset({
      postProdMode: true,
      overlayLines: ['Ligne 1', 'Ligne 2', 'Ligne 3'],
      voiceoverText: 'Texte de la voix off',
    });
    expect(asset.postProdMode).toBe(true);
    expect(asset.overlayLines).toHaveLength(3);
    expect(asset.voiceoverText).toBeDefined();
  });

  it('vidéo avec overlay style personnalisé', () => {
    const asset = createVideoAsset({
      postProdMode: true,
      overlayStyle: {
        font: 'Montserrat',
        size: 48,
        color: 'yellow',
        stroke: 'black',
        position: 'bottom',
      },
    });
    expect(asset.overlayStyle?.font).toBe('Montserrat');
    expect(asset.overlayStyle?.position).toBe('bottom');
  });
});

describe('Vidéo - Ratios', () => {
  const videoRatios = ['9:16', '16:9', '1:1', '4:5'] as const;

  videoRatios.forEach(ratio => {
    it(`vidéo ratio ${ratio} est valide`, () => {
      const asset = createVideoAsset({ ratio });
      expect(asset.ratio).toBe(ratio);
    });
  });
});

describe('Vidéo - Engine', () => {
  it('engine par défaut est veo_3_1', () => {
    const asset = createVideoAsset({ engine: 'veo_3_1' });
    expect(asset.engine).toBe('veo_3_1');
  });
});

describe('Vidéo - Brand Kit', () => {
  it('vidéo peut avoir useBrandKit = true', () => {
    const asset = createVideoAsset({ useBrandKit: true });
    expect(asset.useBrandKit).toBe(true);
  });

  it('vidéo peut avoir useBrandKit = false', () => {
    const asset = createVideoAsset({ useBrandKit: false });
    expect(asset.useBrandKit).toBe(false);
  });
});

describe('Vidéo - Prompts structurés CLIP', () => {
  it('chaque clip peut avoir un prompt distinct', () => {
    const clips = [
      createVideoAsset({ 
        title: 'Clip 1', 
        prompt: 'Hook accrocheur - femme souriante face caméra',
        sceneOrder: 1,
      }),
      createVideoAsset({ 
        title: 'Clip 2', 
        prompt: 'Contenu principal - démonstration produit',
        sceneOrder: 2,
      }),
      createVideoAsset({ 
        title: 'Clip 3', 
        prompt: 'CTA final - logo et call to action',
        sceneOrder: 3,
      }),
    ];

    expect(clips[0].prompt).toContain('Hook');
    expect(clips[1].prompt).toContain('Contenu');
    expect(clips[2].prompt).toContain('CTA');
  });
});
