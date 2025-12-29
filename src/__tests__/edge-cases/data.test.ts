/**
 * Tests Edge Cases Data - Phase 4 Robustesse
 * Vérifie la gestion des données malformées et cas limites
 */

import { describe, it, expect } from 'vitest';

// Types pour la validation
interface JobPayload {
  prompt: string;
  type: string;
  options?: Record<string, any>;
}

interface BrandPalette {
  primary: string;
  secondary: string;
  accent: string;
}

// Service de validation simulé
const dataValidationService = {
  parseJobPayload: (jsonString: string): { valid: boolean; payload?: JobPayload; error?: string } => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.prompt || !parsed.type) {
        return { valid: false, error: 'Missing required fields' };
      }
      return { valid: true, payload: parsed };
    } catch {
      return { valid: false, error: 'Invalid JSON format' };
    }
  },
  
  validateImageUrl: (url: string): { valid: boolean; fallbackUrl?: string } => {
    const validPatterns = [
      /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
      /^https:\/\/res\.cloudinary\.com\/.+/,
      /^data:image\/.+/,
    ];
    
    const isValid = validPatterns.some(pattern => pattern.test(url));
    
    if (!isValid) {
      return { valid: false, fallbackUrl: '/placeholder.svg' };
    }
    return { valid: true };
  },
  
  normalizeVideoDuration: (duration: number | undefined): number => {
    const DEFAULT_DURATION = 8;
    const MIN_DURATION = 1;
    const MAX_DURATION = 60;
    
    if (duration === undefined || duration === null || duration === 0) {
      return DEFAULT_DURATION;
    }
    
    return Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));
  },
  
  validatePrompt: (prompt: string): { valid: boolean; message?: string } => {
    if (!prompt || prompt.trim().length === 0) {
      return { valid: false, message: 'Veuillez décrire ce que vous souhaitez créer.' };
    }
    
    if (prompt.trim().length < 10) {
      return { valid: false, message: 'Le prompt doit contenir au moins 10 caractères.' };
    }
    
    return { valid: true };
  },
  
  escapeSpecialChars: (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  
  getDefaultPalette: (palette: Partial<BrandPalette> | null): BrandPalette => {
    const defaults: BrandPalette = {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
    };
    
    if (!palette) return defaults;
    
    return {
      primary: palette.primary || defaults.primary,
      secondary: palette.secondary || defaults.secondary,
      accent: palette.accent || defaults.accent,
    };
  },
};

describe('Edge Cases Data - Malformed JSON', () => {
  it('JSON malformé dans payload job → log error, skip', () => {
    const malformedJson = '{ invalid json }';
    
    const result = dataValidationService.parseJobPayload(malformedJson);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid JSON format');
    expect(result.payload).toBeUndefined();
  });
  
  it('JSON valide mais incomplet → erreur champs manquants', () => {
    const incompleteJson = '{ "prompt": "test" }';
    
    const result = dataValidationService.parseJobPayload(incompleteJson);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required fields');
  });
  
  it('JSON valide et complet → succès', () => {
    const validJson = '{ "prompt": "Create an image", "type": "image" }';
    
    const result = dataValidationService.parseJobPayload(validJson);
    
    expect(result.valid).toBe(true);
    expect(result.payload?.prompt).toBe('Create an image');
  });
});

describe('Edge Cases Data - Invalid URLs', () => {
  it('URL image invalide → fallback placeholder', () => {
    const invalidUrls = [
      'not-a-url',
      'ftp://invalid.com/image.png',
      'https://example.com/noextension',
      '',
    ];
    
    invalidUrls.forEach(url => {
      const result = dataValidationService.validateImageUrl(url);
      expect(result.valid).toBe(false);
      expect(result.fallbackUrl).toBe('/placeholder.svg');
    });
  });
  
  it('URL image valide → succès', () => {
    const validUrls = [
      'https://example.com/image.png',
      'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      'http://test.com/photo.webp',
    ];
    
    validUrls.forEach(url => {
      const result = dataValidationService.validateImageUrl(url);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Edge Cases Data - Video Duration', () => {
  it('Durée vidéo 0 → valeur par défaut 8s', () => {
    expect(dataValidationService.normalizeVideoDuration(0)).toBe(8);
  });
  
  it('Durée vidéo undefined → valeur par défaut 8s', () => {
    expect(dataValidationService.normalizeVideoDuration(undefined)).toBe(8);
  });
  
  it('Durée vidéo négative → minimum 1s', () => {
    expect(dataValidationService.normalizeVideoDuration(-5)).toBe(1);
  });
  
  it('Durée vidéo excessive → maximum 60s', () => {
    expect(dataValidationService.normalizeVideoDuration(120)).toBe(60);
  });
  
  it('Durée vidéo normale → conservée', () => {
    expect(dataValidationService.normalizeVideoDuration(15)).toBe(15);
  });
});

describe('Edge Cases Data - Empty Prompt', () => {
  it('Prompt vide → message demande clarification', () => {
    const result = dataValidationService.validatePrompt('');
    
    expect(result.valid).toBe(false);
    expect(result.message).toContain('décrire');
  });
  
  it('Prompt trop court → message minimum caractères', () => {
    const result = dataValidationService.validatePrompt('test');
    
    expect(result.valid).toBe(false);
    expect(result.message).toContain('10 caractères');
  });
  
  it('Prompt valide → succès', () => {
    const result = dataValidationService.validatePrompt('Créer une image marketing pour Instagram');
    
    expect(result.valid).toBe(true);
  });
});

describe('Edge Cases Data - Special Characters', () => {
  it('Caractères spéciaux dans prompt → échappement correct', () => {
    const dangerousInput = '<script>alert("XSS")</script>';
    
    const escaped = dataValidationService.escapeSpecialChars(dangerousInput);
    
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&quot;');
  });
  
  it('Texte normal → inchangé sauf caractères spéciaux', () => {
    const normalInput = 'Hello World';
    
    const result = dataValidationService.escapeSpecialChars(normalInput);
    
    expect(result).toBe('Hello World');
  });
});

describe('Edge Cases Data - Missing Brand Palette', () => {
  it('Brand sans palette → couleurs par défaut', () => {
    const palette = dataValidationService.getDefaultPalette(null);
    
    expect(palette.primary).toBe('#3B82F6');
    expect(palette.secondary).toBe('#10B981');
    expect(palette.accent).toBe('#F59E0B');
  });
  
  it('Brand avec palette partielle → fusion avec défauts', () => {
    const partialPalette = { primary: '#FF0000' };
    
    const palette = dataValidationService.getDefaultPalette(partialPalette);
    
    expect(palette.primary).toBe('#FF0000');
    expect(palette.secondary).toBe('#10B981'); // Défaut
    expect(palette.accent).toBe('#F59E0B'); // Défaut
  });
});
