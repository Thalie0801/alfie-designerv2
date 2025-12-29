/**
 * Tests pour src/lib/chat/detect.ts
 * Détection d'intent de contenu et navigation
 */

import { describe, it, expect } from 'vitest';
import { detectContentIntent, detectPlatformHelp } from '@/lib/chat/detect';

describe('detectContentIntent', () => {
  describe('Détection de mode', () => {
    it('détecte une demande de carrousel', () => {
      const result = detectContentIntent('Fais-moi un carrousel sur le freelancing');
      expect(result.mode).toBe('carousel');
      expect(result.explicitMode).toBe(true);
    });

    it('détecte une demande de vidéo', () => {
      const result = detectContentIntent('Créer une vidéo de présentation');
      expect(result.mode).toBe('video');
      expect(result.explicitMode).toBe(true);
    });

    it('détecte une demande d\'image', () => {
      const result = detectContentIntent('Un visuel pour mon post LinkedIn');
      expect(result.mode).toBe('image');
      expect(result.explicitMode).toBe(true);
    });

    it('détecte les reels comme vidéo', () => {
      const result = detectContentIntent('Un reel Instagram tendance');
      expect(result.mode).toBe('video');
    });

    it('détecte les slides comme carrousel', () => {
      const result = detectContentIntent('5 slides sur le marketing');
      expect(result.mode).toBe('carousel');
    });
  });

  describe('Détection de plateforme', () => {
    it('détecte Instagram', () => {
      const result = detectContentIntent('Post Instagram 1:1');
      expect(result.platform).toBe('instagram');
    });

    it('détecte TikTok', () => {
      const result = detectContentIntent('Vidéo TikTok courte');
      expect(result.platform).toBe('tiktok');
    });

    it('détecte LinkedIn', () => {
      const result = detectContentIntent('Carrousel LinkedIn pro');
      expect(result.platform).toBe('linkedin');
    });

    it('détecte Pinterest', () => {
      const result = detectContentIntent('Pin Pinterest vertical');
      expect(result.platform).toBe('pinterest');
    });

    it('détecte YouTube/Shorts', () => {
      const result = detectContentIntent('Short YouTube viral');
      expect(result.platform).toBe('youtube');
    });
  });

  describe('Détection de ratio', () => {
    const ratios = ['1:1', '9:16', '16:9', '4:5', '2:3', '3:4'] as const;
    
    ratios.forEach(ratio => {
      it(`détecte le ratio ${ratio}`, () => {
        const result = detectContentIntent(`Image format ${ratio}`);
        expect(result.ratio).toBe(ratio);
      });
    });

    it('applique le ratio par défaut pour carrousel', () => {
      const result = detectContentIntent('Carrousel Instagram');
      expect(result.ratio).toBe('4:5');
    });

    it('applique le ratio par défaut pour vidéo', () => {
      const result = detectContentIntent('Vidéo sans plateforme');
      expect(result.ratio).toBe('9:16');
    });
  });

  describe('Détection de ton', () => {
    it('détecte le ton premium/minimal', () => {
      const result = detectContentIntent('Style Apple minimal');
      expect(result.tone).toBe('premium');
    });

    it('détecte le ton fun', () => {
      const result = detectContentIntent('Carrousel fun avec emoji');
      expect(result.tone).toBe('fun');
    });

    it('détecte le ton B2B', () => {
      const result = detectContentIntent('Post LinkedIn corporate B2B');
      expect(result.tone).toBe('b2b');
    });
  });

  describe('Détection de slides', () => {
    it('détecte le nombre de slides explicite', () => {
      const result = detectContentIntent('Carrousel 7 slides marketing');
      expect(result.slides).toBe(7);
    });

    it('limite le nombre de slides à 10 max', () => {
      const result = detectContentIntent('Carrousel 15 slides');
      expect(result.slides).toBe(10);
    });

    it('garantit minimum 3 slides', () => {
      const result = detectContentIntent('Carrousel 1 slide');
      expect(result.slides).toBe(3);
    });

    it('utilise 5 slides par défaut pour carrousel', () => {
      const result = detectContentIntent('Carrousel sur le SEO');
      expect(result.slides).toBe(5);
    });
  });

  describe('Détection de CTA', () => {
    it('détecte un CTA explicite', () => {
      const result = detectContentIntent('Post avec cta: "Réserve ton appel"');
      expect(result.cta).toBe('Réserve ton appel');
    });
  });

  describe('Détection de niche', () => {
    it('détecte e-commerce', () => {
      const result = detectContentIntent('Image pour ma boutique en ligne');
      expect(result.niche).toBe('ecommerce');
    });

    it('détecte infopreneur', () => {
      const result = detectContentIntent('Carrousel pour ma formation en ligne');
      expect(result.niche).toBe('infopreneur');
    });

    it('détecte services', () => {
      const result = detectContentIntent('Post pour mon activité de coach');
      expect(result.niche).toBe('services');
    });
  });
});

describe('detectPlatformHelp', () => {
  describe('Navigation explicite', () => {
    it('détecte une demande d\'ouverture du studio', () => {
      const result = detectPlatformHelp('Ouvre le studio');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].to).toBe('/studio');
    });

    it('détecte une demande de bibliothèque', () => {
      const result = detectPlatformHelp('Accéder à ma bibliothèque');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].to).toBe('/library');
    });

    it('détecte une demande de brand kit', () => {
      const result = detectPlatformHelp('Modifier mon brand kit');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].to).toBe('/brand-kit-questionnaire');
    });
  });

  describe('Exclusion des faux positifs', () => {
    it('n\'ouvre pas studio pour une demande de création', () => {
      const result = detectPlatformHelp('Créer une vidéo de 3 assets');
      // Ne doit PAS matcher /studio car c'est une demande de création
      const studioMatch = result.matches.find(m => m.to === '/studio');
      expect(studioMatch).toBeUndefined();
    });

    it('n\'ouvre pas library pour une demande de création', () => {
      const result = detectPlatformHelp('Génère 5 images pour ma campagne');
      const libraryMatch = result.matches.find(m => m.to === '/library');
      expect(libraryMatch).toBeUndefined();
    });
  });

  describe('What can I do', () => {
    it('détecte les questions sur les capacités', () => {
      const result = detectPlatformHelp('Que peux-tu faire ?');
      expect(result.isWhatCanDo).toBe(true);
    });

    it('détecte les demandes d\'aide', () => {
      const result = detectPlatformHelp('Comment ça marche ?');
      expect(result.isWhatCanDo).toBe(true);
    });
  });
});
