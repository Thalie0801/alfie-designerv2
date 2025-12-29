/**
 * Mocks de packs Alfie pour les tests
 */

import type { AlfiePack, PackAsset } from '@/types/alfiePack';

// Assets images mock
export const createImageAsset = (overrides: Partial<PackAsset> = {}): PackAsset => ({
  id: crypto.randomUUID(),
  brandId: 'brand-123',
  kind: 'image',
  title: 'Image test',
  prompt: 'Un visuel professionnel pour coach',
  platform: 'instagram',
  ratio: '1:1',
  goal: 'engagement',
  tone: 'premium',
  count: 1,
  woofCostType: 'image',
  ...overrides,
} as PackAsset);

// Assets carrousel mock
export const createCarouselAsset = (overrides: Partial<PackAsset> = {}): PackAsset => ({
  id: crypto.randomUUID(),
  brandId: 'brand-123',
  kind: 'carousel',
  title: 'Carrousel test',
  prompt: '5 conseils pour entrepreneurs',
  platform: 'instagram',
  ratio: '4:5',
  goal: 'education',
  tone: 'premium',
  count: 5,
  woofCostType: 'carousel',
  carouselType: 'content',
  generatedTexts: {
    slides: [
      { title: 'Slide 1', subtitle: 'Introduction', bullets: ['Point 1', 'Point 2'] },
      { title: 'Slide 2', subtitle: 'Conseil 1', bullets: ['Détail A', 'Détail B'] },
      { title: 'Slide 3', subtitle: 'Conseil 2', bullets: ['Détail C', 'Détail D'] },
      { title: 'Slide 4', subtitle: 'Conseil 3', bullets: ['Détail E', 'Détail F'] },
      { title: 'Slide 5', subtitle: 'Conclusion', bullets: ['CTA 1', 'CTA 2'] },
    ],
  },
  ...overrides,
} as PackAsset);

// Assets vidéo mock
export const createVideoAsset = (overrides: Partial<PackAsset> = {}): PackAsset => ({
  id: crypto.randomUUID(),
  brandId: 'brand-123',
  kind: 'video_premium',
  title: 'Vidéo test',
  prompt: 'Présentation dynamique de mon activité',
  platform: 'instagram',
  ratio: '9:16',
  goal: 'engagement',
  tone: 'premium',
  count: 1,
  durationSeconds: 8,
  woofCostType: 'video_premium',
  ...overrides,
} as PackAsset);

// Pack solo image
export const mockSoloImagePack: AlfiePack = {
  title: 'Pack Solo Image',
  summary: 'Un visuel unique pour Instagram',
  assets: [createImageAsset()],
};

// Pack multi images
export const mockMultiImagePack = (count: number = 5): AlfiePack => ({
  title: `Pack ${count} Images`,
  summary: `${count} visuels cohérents`,
  assets: Array.from({ length: count }, (_, i) => 
    createImageAsset({ 
      title: `Image ${i + 1}`,
      coherenceGroup: 'group-123',
    })
  ),
});

// Pack solo carrousel
export const mockSoloCarouselPack: AlfiePack = {
  title: 'Pack Solo Carrousel',
  summary: 'Un carrousel 5 slides',
  assets: [createCarouselAsset()],
};

// Pack multi carrousels
export const mockMultiCarouselPack = (count: number = 3): AlfiePack => ({
  title: `Pack ${count} Carrousels`,
  summary: `${count} carrousels distincts`,
  assets: Array.from({ length: count }, (_, i) => 
    createCarouselAsset({ title: `Carrousel ${i + 1}` })
  ),
});

// Pack solo vidéo
export const mockSoloVideoPack: AlfiePack = {
  title: 'Pack Solo Vidéo',
  summary: 'Une vidéo premium Veo 3.1',
  assets: [createVideoAsset()],
};

// Pack multi clips vidéo
export const mockMultiVideoPack = (count: number = 3): AlfiePack => ({
  title: `Pack ${count} Clips Vidéo`,
  summary: `${count} clips distincts`,
  assets: Array.from({ length: count }, (_, i) => 
    createVideoAsset({ 
      title: `Clip ${i + 1}`,
      scriptGroup: 'script-123',
      sceneOrder: i + 1,
    })
  ),
});

// Pack mixte (images + carrousel + vidéo)
export const mockMixedPack: AlfiePack = {
  title: 'Pack Mixte Complet',
  summary: '2 images + 1 carrousel + 1 vidéo',
  assets: [
    createImageAsset({ title: 'Image 1' }),
    createImageAsset({ title: 'Image 2' }),
    createCarouselAsset({ title: 'Carrousel principal' }),
    createVideoAsset({ title: 'Vidéo de présentation' }),
  ],
};

// Réponses LLM simulées avec <alfie-pack>
export const buildMockLLMResponseWithPack = (pack: AlfiePack): string => {
  return `Voici ce que je te propose pour ton contenu !

<alfie-pack>
${JSON.stringify(pack, null, 2)}
</alfie-pack>

Tu veux que je génère ce pack ?`;
};

// Réponse LLM sans pack (conversation)
export const MOCK_LLM_CONVERSATION_RESPONSE = `Bien sûr ! Peux-tu me donner plus de détails sur :
1. Ta niche / ton activité
2. Le réseau social cible
3. Le ton souhaité (pro, fun, etc.)`;
