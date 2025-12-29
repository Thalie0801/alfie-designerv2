/**
 * Tests pour les packs mixtes et edge cases
 * Scénarios: multi-types, parsing JSON, woofs insuffisants, erreurs
 */

import { describe, it, expect } from 'vitest';
import { 
  mockMixedPack,
  createImageAsset,
  createCarouselAsset,
  createVideoAsset,
  buildMockLLMResponseWithPack,
  MOCK_LLM_CONVERSATION_RESPONSE,
} from '../mocks/packMocks';
import { calculatePackWoofCost } from '@/lib/woofs';

describe('Packs Mixtes - Structure', () => {
  it('pack mixte contient différents types d\'assets', () => {
    const kinds = mockMixedPack.assets.map(a => a.kind);
    expect(kinds).toContain('image');
    expect(kinds).toContain('carousel');
    expect(kinds).toContain('video_premium');
  });

  it('pack mixte: 2 images + 1 carrousel + 1 vidéo = 4 assets', () => {
    expect(mockMixedPack.assets).toHaveLength(4);
  });

  it('chaque asset a un ID unique dans le pack mixte', () => {
    const ids = mockMixedPack.assets.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);
  });
});

describe('Packs Mixtes - Calcul Woofs', () => {
  it('pack mixte: 2×1 + 1×10 + 1×25 = 37 Woofs', () => {
    const cost = calculatePackWoofCost(mockMixedPack);
    expect(cost).toBe(37);
  });

  it('sélection partielle calcule correctement', () => {
    const imageIds = mockMixedPack.assets
      .filter(a => a.kind === 'image')
      .map(a => a.id);
    const cost = calculatePackWoofCost(mockMixedPack, imageIds);
    expect(cost).toBe(2); // 2 images × 1 Woof
  });

  it('pack complexe: 5 images + 3 carrousels + 2 vidéos = 85 Woofs', () => {
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
    expect(cost).toBe(85); // 5 + 30 + 50
  });
});

describe('Parsing JSON - alfie-pack', () => {
  it('parse correctement une réponse LLM avec pack', () => {
    const pack = mockMixedPack;
    const response = buildMockLLMResponseWithPack(pack);
    
    // Simuler le parsing (indexOf/slice)
    const startTag = '<alfie-pack>';
    const endTag = '</alfie-pack>';
    const startIdx = response.toLowerCase().indexOf(startTag.toLowerCase());
    const endIdx = response.toLowerCase().indexOf(endTag.toLowerCase());
    
    expect(startIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(startIdx);
    
    const jsonContent = response.slice(startIdx + startTag.length, endIdx).trim();
    const parsed = JSON.parse(jsonContent);
    
    expect(parsed.title).toBe(pack.title);
    expect(parsed.assets).toHaveLength(4);
  });

  it('détecte absence de pack dans réponse conversationnelle', () => {
    const response = MOCK_LLM_CONVERSATION_RESPONSE;
    const startTag = '<alfie-pack>';
    const startIdx = response.toLowerCase().indexOf(startTag.toLowerCase());
    
    expect(startIdx).toBe(-1); // Pas de pack
  });

  it('gère JSON avec caractères spéciaux', () => {
    const pack = {
      title: 'Pack avec "guillemets" et accents éàü',
      summary: "Résumé avec l'apostrophe",
      assets: [createImageAsset({ prompt: 'Image "spéciale"' })],
    };
    
    const response = buildMockLLMResponseWithPack(pack);
    const startTag = '<alfie-pack>';
    const endTag = '</alfie-pack>';
    const startIdx = response.indexOf(startTag);
    const endIdx = response.indexOf(endTag, startIdx);
    const jsonContent = response.slice(startIdx + startTag.length, endIdx).trim();
    
    const parsed = JSON.parse(jsonContent);
    expect(parsed.title).toContain('guillemets');
    expect(parsed.summary).toContain("l'apostrophe");
  });
});

describe('Edge Cases - Packs vides', () => {
  it('pack vide retourne 0 Woofs', () => {
    const emptyPack = { title: 'Empty', summary: '', assets: [] };
    const cost = calculatePackWoofCost(emptyPack);
    expect(cost).toBe(0);
  });

  it('sélection vide retourne 0 Woofs', () => {
    const cost = calculatePackWoofCost(mockMixedPack, []);
    expect(cost).toBe(0);
  });

  it('sélection avec IDs inexistants retourne 0', () => {
    const cost = calculatePackWoofCost(mockMixedPack, ['fake-id-1', 'fake-id-2']);
    expect(cost).toBe(0);
  });
});

describe('Edge Cases - Valeurs limites', () => {
  it('gère count = 0 pour image', () => {
    const asset = createImageAsset({ count: 0 });
    const pack = { title: 'Test', summary: '', assets: [asset] };
    // L'asset est toujours compté comme 1 (coût minimum)
    const cost = calculatePackWoofCost(pack);
    expect(cost).toBe(1);
  });

  it('gère durationSeconds = 0 pour vidéo', () => {
    const asset = createVideoAsset({ durationSeconds: 0 });
    expect(asset.durationSeconds).toBe(0);
  });
});

describe('Edge Cases - Types manquants', () => {
  it('asset sans generatedTexts reste valide', () => {
    const asset = createCarouselAsset({ generatedTexts: undefined });
    expect(asset.generatedTexts).toBeUndefined();
    expect(asset.kind).toBe('carousel');
  });

  it('asset sans referenceImageUrl reste valide', () => {
    const asset = createVideoAsset({ referenceImageUrl: undefined });
    expect(asset.referenceImageUrl).toBeUndefined();
  });
});

describe('Multi-intent parsing', () => {
  it('détecte plusieurs packs dans une réponse', () => {
    const pack1 = { 
      title: 'Pack 1', 
      summary: '', 
      assets: [createImageAsset()] 
    };
    const pack2 = { 
      title: 'Pack 2', 
      summary: '', 
      assets: [createCarouselAsset()] 
    };
    
    const response = `
      Premier pack:
      <alfie-pack>${JSON.stringify(pack1)}</alfie-pack>
      
      Deuxième pack:
      <alfie-pack>${JSON.stringify(pack2)}</alfie-pack>
    `;
    
    // Simuler parseMultipleIntents
    const packs: any[] = [];
    let searchStart = 0;
    const startTag = '<alfie-pack>';
    const endTag = '</alfie-pack>';
    
    while (true) {
      const startIdx = response.toLowerCase().indexOf(startTag.toLowerCase(), searchStart);
      if (startIdx === -1) break;
      
      const endIdx = response.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
      if (endIdx === -1) break;
      
      const jsonContent = response.slice(startIdx + startTag.length, endIdx).trim();
      try {
        packs.push(JSON.parse(jsonContent));
      } catch { /* ignore */ }
      
      searchStart = endIdx + endTag.length;
    }
    
    expect(packs).toHaveLength(2);
    expect(packs[0].title).toBe('Pack 1');
    expect(packs[1].title).toBe('Pack 2');
  });
});

describe('Confirmation messages', () => {
  const confirmationMessages = [
    'ok',
    'oui',
    "c'est bon",
    'on y va',
    'lance',
    'parfait',
    'go',
    "d'accord",
  ];

  confirmationMessages.forEach(msg => {
    it(`"${msg}" est reconnu comme confirmation`, () => {
      const isConfirmation = /^(ok|oui|c'est bon|on y va|lance|parfait|go|d'accord|da)[\s!.,]*$/i.test(msg.trim());
      expect(isConfirmation).toBe(true);
    });
  });

  const nonConfirmationMessages = [
    'Crée une vidéo de 3 clips',
    'Je veux un carrousel sur le freelancing',
    '5 images pour Instagram',
  ];

  nonConfirmationMessages.forEach(msg => {
    it(`"${msg}" n'est PAS une confirmation`, () => {
      const isConfirmation = /^(ok|oui|c'est bon|on y va|lance|parfait|go|d'accord|da)[\s!.,]*$/i.test(msg.trim());
      expect(isConfirmation).toBe(false);
    });
  });
});
