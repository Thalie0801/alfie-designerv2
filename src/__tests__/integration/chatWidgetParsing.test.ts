/**
 * Tests d'intégration pour le parsing alfie-chat-widget
 * Tests: parsePack, forceMultiClips, extractClipInfos
 */

import { describe, it, expect } from 'vitest';
import { 
  mockSoloImagePack,
  mockSoloVideoPack,
  mockMixedPack,
  createVideoAsset,
  buildMockLLMResponseWithPack,
} from '../mocks/packMocks';
import type { AlfiePack } from '@/types/alfiePack';

/**
 * Simule parsePack() de alfie-chat-widget
 */
function parsePack(text: string): AlfiePack | null {
  const startTag = '<alfie-pack>';
  const endTag = '</alfie-pack>';
  
  const lowerText = text.toLowerCase();
  const startIdx = lowerText.indexOf(startTag.toLowerCase());
  if (startIdx === -1) return null;
  
  const endIdx = lowerText.indexOf(endTag.toLowerCase(), startIdx);
  if (endIdx === -1) return null;
  
  let jsonContent = text.slice(startIdx + startTag.length, endIdx).trim();
  
  // Nettoyer les backticks markdown
  jsonContent = jsonContent.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
  
  // Nettoyer les newlines dans les strings
  jsonContent = jsonContent.replace(/\n/g, '\\n');
  
  try {
    // Parse et reparse pour nettoyer les \\n en vrais \n
    const parsed = JSON.parse(jsonContent.replace(/\\n/g, '\n'));
    return parsed as AlfiePack;
  } catch {
    // Fallback: extraction minimale
    try {
      const titleMatch = jsonContent.match(/"title"\s*:\s*"([^"]+)"/);
      const title = titleMatch?.[1] || 'Pack récupéré';
      return { title, summary: '', assets: [] };
    } catch {
      return null;
    }
  }
}

/**
 * Simule forceMultiClips() - détecte et force N clips distincts
 */
function forceMultiClips(userPrompt: string, pack: AlfiePack): AlfiePack {
  // Patterns de détection
  const patterns = [
    /(\d+)\s*clips?\s*(sépar[ée]s|distincts?)?/i,
    /vidéo\s*de\s*(\d+)\s*assets?/i,
    /CLIP\s+\d+.*CLIP\s+\d+/is,
  ];
  
  let targetCount = 1;
  
  for (const pattern of patterns) {
    const match = userPrompt.match(pattern);
    if (match) {
      if (match[1]) {
        targetCount = parseInt(match[1], 10);
      } else {
        // Compter les CLIP X dans le prompt
        const clipMatches = userPrompt.match(/CLIP\s+\d+/gi);
        if (clipMatches) {
          targetCount = clipMatches.length;
        }
      }
      break;
    }
  }
  
  // Si le pack a déjà le bon nombre, on retourne tel quel
  const videoAssets = pack.assets.filter(a => a.kind === 'video_premium');
  if (videoAssets.length === targetCount) return pack;
  
  // Sinon, on duplique/ajuste
  if (targetCount > 1 && videoAssets.length === 1) {
    const baseAsset = videoAssets[0];
    const newAssets = Array.from({ length: targetCount }, (_, i) => ({
      ...baseAsset,
      id: `${baseAsset.id}-clip-${i + 1}`,
      title: `Clip ${i + 1}`,
      sceneOrder: i + 1,
      scriptGroup: `script-${baseAsset.id}`,
    }));
    
    return {
      ...pack,
      assets: [
        ...pack.assets.filter(a => a.kind !== 'video_premium'),
        ...newAssets,
      ],
    };
  }
  
  return pack;
}

/**
 * Simule extractClipInfos() - extrait les infos par clip
 */
function extractClipInfos(prompt: string): Array<{ index: number; prompt: string; overlay?: string[] }> {
  const clipPattern = /CLIP\s+(\d+)\s*[:\-]?\s*([\s\S]*?)(?=CLIP\s+\d+|$)/gi;
  const clips: Array<{ index: number; prompt: string; overlay?: string[] }> = [];
  
  let match;
  while ((match = clipPattern.exec(prompt)) !== null) {
    const index = parseInt(match[1], 10);
    let clipPrompt = match[2].trim();
    
    // Extraire overlay lines si présentes
    const overlayMatch = clipPrompt.match(/OVERLAY\s*[:\-]?\s*(.+)/i);
    let overlay: string[] | undefined;
    if (overlayMatch) {
      overlay = overlayMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
      clipPrompt = clipPrompt.replace(/OVERLAY\s*[:\-]?\s*.+/i, '').trim();
    }
    
    clips.push({ index, prompt: clipPrompt, overlay });
  }
  
  return clips.sort((a, b) => a.index - b.index);
}

describe('parsePack - Basic parsing', () => {
  it('parse correctement un pack JSON valide', () => {
    const response = buildMockLLMResponseWithPack(mockSoloImagePack);
    const parsed = parsePack(response);
    
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe(mockSoloImagePack.title);
    expect(parsed?.assets).toHaveLength(1);
  });

  it('parse un pack mixte avec plusieurs assets', () => {
    const response = buildMockLLMResponseWithPack(mockMixedPack);
    const parsed = parsePack(response);
    
    expect(parsed).not.toBeNull();
    expect(parsed?.assets).toHaveLength(4);
  });

  it('retourne null si pas de balise alfie-pack', () => {
    const response = 'Voici une réponse sans pack JSON';
    const parsed = parsePack(response);
    
    expect(parsed).toBeNull();
  });

  it('retourne null si balise fermante manquante', () => {
    const response = '<alfie-pack>{"title": "Test"';
    const parsed = parsePack(response);
    
    expect(parsed).toBeNull();
  });
});

describe('parsePack - Markdown cleanup', () => {
  it('nettoie les backticks markdown ```json', () => {
    const pack = mockSoloImagePack;
    const response = `Voici le pack:
<alfie-pack>
\`\`\`json
${JSON.stringify(pack)}
\`\`\`
</alfie-pack>`;
    
    const parsed = parsePack(response);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe(pack.title);
  });

  it('nettoie les backticks simples ```', () => {
    const pack = mockSoloImagePack;
    const response = `<alfie-pack>
\`\`\`
${JSON.stringify(pack)}
\`\`\`
</alfie-pack>`;
    
    const parsed = parsePack(response);
    expect(parsed).not.toBeNull();
  });
});

describe('parsePack - Special characters', () => {
  it('gère les guillemets dans le contenu', () => {
    const pack = {
      title: 'Pack avec "guillemets"',
      summary: 'Test',
      assets: [],
    };
    const response = buildMockLLMResponseWithPack(pack as AlfiePack);
    const parsed = parsePack(response);
    
    expect(parsed?.title).toContain('guillemets');
  });

  it('gère les accents et caractères spéciaux', () => {
    const pack = {
      title: 'Pack éàüö spécial',
      summary: "Résumé avec l'apostrophe",
      assets: [],
    };
    const response = buildMockLLMResponseWithPack(pack as AlfiePack);
    const parsed = parsePack(response);
    
    expect(parsed?.title).toContain('éàüö');
    expect(parsed?.summary).toContain("l'apostrophe");
  });
});

describe('parsePack - Fallback extraction', () => {
  it('extrait le titre même si JSON invalide', () => {
    const response = `<alfie-pack>
{
  "title": "Pack récupérable",
  "assets": [invalid json here
</alfie-pack>`;
    
    const parsed = parsePack(response);
    // Le fallback devrait au moins récupérer le titre
    expect(parsed?.title).toContain('récupér');
  });
});

describe('forceMultiClips - Detection patterns', () => {
  it('détecte "3 clips séparés"', () => {
    const pack = mockSoloVideoPack;
    const result = forceMultiClips('Créer 3 clips séparés pour TikTok', pack);
    
    expect(result.assets.filter(a => a.kind === 'video_premium')).toHaveLength(3);
  });

  it('détecte "5 clips distincts"', () => {
    const pack = mockSoloVideoPack;
    const result = forceMultiClips('Je veux 5 clips distincts', pack);
    
    expect(result.assets.filter(a => a.kind === 'video_premium')).toHaveLength(5);
  });

  it('détecte "vidéo de 4 assets"', () => {
    const pack = mockSoloVideoPack;
    const result = forceMultiClips('Une vidéo de 4 assets', pack);
    
    expect(result.assets.filter(a => a.kind === 'video_premium')).toHaveLength(4);
  });

  it('détecte CLIP 1, CLIP 2, CLIP 3 dans le prompt', () => {
    const pack = mockSoloVideoPack;
    const prompt = `
      CLIP 1: Hook accrocheur
      CLIP 2: Contenu principal  
      CLIP 3: CTA final
    `;
    const result = forceMultiClips(prompt, pack);
    
    expect(result.assets.filter(a => a.kind === 'video_premium')).toHaveLength(3);
  });

  it('conserve le pack si déjà le bon nombre de clips', () => {
    const pack = {
      title: 'Test',
      summary: '',
      assets: [
        createVideoAsset({ title: 'Clip 1' }),
        createVideoAsset({ title: 'Clip 2' }),
        createVideoAsset({ title: 'Clip 3' }),
      ],
    };
    
    const result = forceMultiClips('3 clips séparés', pack);
    expect(result.assets).toHaveLength(3);
  });
});

describe('forceMultiClips - Asset enrichment', () => {
  it('ajoute scriptGroup aux clips générés', () => {
    const pack = mockSoloVideoPack;
    const result = forceMultiClips('3 clips', pack);
    
    const videoAssets = result.assets.filter(a => a.kind === 'video_premium');
    videoAssets.forEach(asset => {
      expect(asset.scriptGroup).toBeDefined();
    });
  });

  it('ajoute sceneOrder séquentiel', () => {
    const pack = mockSoloVideoPack;
    const result = forceMultiClips('3 clips', pack);
    
    const videoAssets = result.assets.filter(a => a.kind === 'video_premium');
    const orders = videoAssets.map(a => a.sceneOrder);
    expect(orders).toEqual([1, 2, 3]);
  });

  it('préserve les assets non-vidéo', () => {
    const pack = mockMixedPack; // Contient images + carrousel + vidéo
    const result = forceMultiClips('3 clips vidéo', pack);
    
    const imageAssets = result.assets.filter(a => a.kind === 'image');
    const carouselAssets = result.assets.filter(a => a.kind === 'carousel');
    
    expect(imageAssets).toHaveLength(2);
    expect(carouselAssets).toHaveLength(1);
  });
});

describe('extractClipInfos - Prompt extraction', () => {
  it('extrait les prompts de chaque clip', () => {
    const prompt = `
      CLIP 1: Hook - femme souriante face caméra
      CLIP 2: Démonstration produit en action
      CLIP 3: CTA avec logo animé
    `;
    
    const clips = extractClipInfos(prompt);
    
    expect(clips).toHaveLength(3);
    expect(clips[0].index).toBe(1);
    expect(clips[0].prompt).toContain('Hook');
    expect(clips[1].index).toBe(2);
    expect(clips[1].prompt).toContain('Démonstration');
    expect(clips[2].index).toBe(3);
    expect(clips[2].prompt).toContain('CTA');
  });

  it('extrait les overlay lines si présentes', () => {
    const prompt = `
      CLIP 1: Intro dynamique OVERLAY: Découvrez, notre solution
      CLIP 2: Features OVERLAY: Simple, Rapide, Efficace
    `;
    
    const clips = extractClipInfos(prompt);
    
    expect(clips[0].overlay).toEqual(['Découvrez', 'notre solution']);
    expect(clips[1].overlay).toEqual(['Simple', 'Rapide', 'Efficace']);
  });

  it('gère les clips sans overlay', () => {
    const prompt = `
      CLIP 1: Intro simple
      CLIP 2: Contenu principal
    `;
    
    const clips = extractClipInfos(prompt);
    
    expect(clips[0].overlay).toBeUndefined();
    expect(clips[1].overlay).toBeUndefined();
  });

  it('trie les clips par index', () => {
    const prompt = `
      CLIP 3: Troisième
      CLIP 1: Premier
      CLIP 2: Deuxième
    `;
    
    const clips = extractClipInfos(prompt);
    
    expect(clips[0].index).toBe(1);
    expect(clips[1].index).toBe(2);
    expect(clips[2].index).toBe(3);
  });

  it('retourne tableau vide si pas de pattern CLIP', () => {
    const prompt = 'Une vidéo simple sans structure CLIP';
    const clips = extractClipInfos(prompt);
    
    expect(clips).toHaveLength(0);
  });
});

describe('Multi-intent parsing', () => {
  it('détecte plusieurs packs dans une réponse', () => {
    const pack1 = mockSoloImagePack;
    const pack2 = mockSoloVideoPack;
    
    const response = `
      Premier pack:
      <alfie-pack>${JSON.stringify(pack1)}</alfie-pack>
      
      Deuxième pack:
      <alfie-pack>${JSON.stringify(pack2)}</alfie-pack>
    `;
    
    // Simuler parseMultipleIntents
    const packs: AlfiePack[] = [];
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
    expect(packs[0].title).toBe(pack1.title);
    expect(packs[1].title).toBe(pack2.title);
  });

  it('fusionne les assets de plusieurs packs', () => {
    const pack1 = mockSoloImagePack;
    const pack2 = mockSoloVideoPack;
    
    // Fusion simulée
    const mergedPack: AlfiePack = {
      title: 'Pack fusionné',
      summary: 'Fusion de plusieurs intents',
      assets: [...pack1.assets, ...pack2.assets],
    };
    
    expect(mergedPack.assets).toHaveLength(2);
    expect(mergedPack.assets[0].kind).toBe('image');
    expect(mergedPack.assets[1].kind).toBe('video_premium');
  });
});
