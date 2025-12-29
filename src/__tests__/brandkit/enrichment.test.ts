/**
 * Tests Brand Kit Enrichment - Phase 2 Core Business
 * Vérifie l'enrichissement des prompts avec les données Brand Kit
 */

import { describe, it, expect } from 'vitest';

// Types Brand Kit
interface BrandKit {
  id: string;
  name: string;
  niche?: string;
  palette?: { primary?: string; secondary?: string; accent?: string; background?: string };
  tone_sliders?: {
    fun_serious?: number;      // 0-100, 0=fun, 100=serious
    accessible_corporate?: number;
    energetic_calm?: number;
    direct_nuanced?: number;
  };
  visual_mood?: string[];      // ['coloré', 'minimaliste', 'contrasté']
  visual_types?: string[];     // ['illustration 2D', 'photo', 'mockup']
  avoid_in_visuals?: string;   // "pas de rouge, pas de personnes"
  voice?: string;
  adjectives?: string[];
  tagline?: string;
}

// Mock Brand Kit
const mockBrandKit: BrandKit = {
  id: 'brand-1',
  name: 'TechStartup',
  niche: 'SaaS B2B',
  palette: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    accent: '#F59E0B',
    background: '#0F172A',
  },
  tone_sliders: {
    fun_serious: 30,           // Plutôt fun
    accessible_corporate: 60,   // Légèrement corporate
    energetic_calm: 70,         // Plutôt calme
    direct_nuanced: 40,         // Plutôt direct
  },
  visual_mood: ['minimaliste', 'tech', 'moderne'],
  visual_types: ['illustration 2D', 'mockup', 'icônes'],
  avoid_in_visuals: 'pas de photos de personnes réelles, éviter le rouge vif',
  voice: 'Professionnel mais accessible, utilise le "vous"',
  adjectives: ['innovant', 'fiable', 'simple'],
  tagline: 'Simplifiez votre workflow',
};

// Service d'enrichissement
const brandEnrichmentService = {
  enrichPromptWithPalette: (prompt: string, brand: BrandKit): string => {
    if (!brand.palette) return prompt;

    const paletteInfo = Object.entries(brand.palette)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return `${prompt}\n\n[PALETTE COULEURS: ${paletteInfo}]`;
  },

  enrichPromptWithToneSliders: (prompt: string, brand: BrandKit): string => {
    if (!brand.tone_sliders) return prompt;

    const toneDescriptions: string[] = [];
    const sliders = brand.tone_sliders;

    if (sliders.fun_serious !== undefined) {
      toneDescriptions.push(sliders.fun_serious < 50 ? 'ton fun et décontracté' : 'ton sérieux et professionnel');
    }
    if (sliders.accessible_corporate !== undefined) {
      toneDescriptions.push(sliders.accessible_corporate < 50 ? 'style accessible' : 'style corporate');
    }
    if (sliders.energetic_calm !== undefined) {
      toneDescriptions.push(sliders.energetic_calm < 50 ? 'énergie dynamique' : 'ambiance calme');
    }
    if (sliders.direct_nuanced !== undefined) {
      toneDescriptions.push(sliders.direct_nuanced < 50 ? 'message direct' : 'approche nuancée');
    }

    return `${prompt}\n\n[TONALITÉ: ${toneDescriptions.join(', ')}]`;
  },

  enrichPromptWithVisualMood: (prompt: string, brand: BrandKit): string => {
    if (!brand.visual_mood || brand.visual_mood.length === 0) return prompt;

    return `${prompt}\n\n[STYLE VISUEL: ${brand.visual_mood.join(', ')}]`;
  },

  enrichPromptWithAvoidInVisuals: (prompt: string, brand: BrandKit): string => {
    if (!brand.avoid_in_visuals) return prompt;

    return `${prompt}\n\n[ÉVITER: ${brand.avoid_in_visuals}]`;
  },

  enrichPromptWithVisualTypes: (prompt: string, brand: BrandKit): string => {
    if (!brand.visual_types || brand.visual_types.length === 0) return prompt;

    return `${prompt}\n\n[TYPES DE VISUELS PRÉFÉRÉS: ${brand.visual_types.join(', ')}]`;
  },

  fullEnrichment: (prompt: string, brand: BrandKit): string => {
    let enrichedPrompt = prompt;

    // Ajouter contexte brand
    if (brand.niche) {
      enrichedPrompt = `[MARQUE: ${brand.name} | NICHE: ${brand.niche}]\n\n${enrichedPrompt}`;
    }

    // Enrichissements séquentiels
    enrichedPrompt = brandEnrichmentService.enrichPromptWithPalette(enrichedPrompt, brand);
    enrichedPrompt = brandEnrichmentService.enrichPromptWithToneSliders(enrichedPrompt, brand);
    enrichedPrompt = brandEnrichmentService.enrichPromptWithVisualMood(enrichedPrompt, brand);
    enrichedPrompt = brandEnrichmentService.enrichPromptWithVisualTypes(enrichedPrompt, brand);
    enrichedPrompt = brandEnrichmentService.enrichPromptWithAvoidInVisuals(enrichedPrompt, brand);

    return enrichedPrompt;
  },
};

describe('Brand Kit - Palette Enrichment', () => {
  it('Prompt enrichi avec palette couleurs', () => {
    const basePrompt = 'Crée une image de dashboard moderne';
    const enriched = brandEnrichmentService.enrichPromptWithPalette(basePrompt, mockBrandKit);

    expect(enriched).toContain('[PALETTE COULEURS:');
    expect(enriched).toContain('#6366F1');
    expect(enriched).toContain('#8B5CF6');
    expect(enriched).toContain('primary');
    expect(enriched).toContain('background');
  });

  it('Prompt inchangé si pas de palette', () => {
    const basePrompt = 'Test prompt';
    const brandWithoutPalette: BrandKit = { id: 'b1', name: 'Test' };
    
    const enriched = brandEnrichmentService.enrichPromptWithPalette(basePrompt, brandWithoutPalette);
    
    expect(enriched).toBe(basePrompt);
  });
});

describe('Brand Kit - Tone Sliders Enrichment', () => {
  it('Prompt enrichi avec tone_sliders', () => {
    const basePrompt = 'Crée un post LinkedIn';
    const enriched = brandEnrichmentService.enrichPromptWithToneSliders(basePrompt, mockBrandKit);

    expect(enriched).toContain('[TONALITÉ:');
    expect(enriched).toContain('fun et décontracté'); // fun_serious = 30
    expect(enriched).toContain('style corporate'); // accessible_corporate = 60
    expect(enriched).toContain('ambiance calme'); // energetic_calm = 70
  });

  it('Interprète correctement les valeurs extrêmes', () => {
    const extremeBrand: BrandKit = {
      id: 'b1',
      name: 'Extreme',
      tone_sliders: {
        fun_serious: 0,           // Max fun
        accessible_corporate: 100, // Max corporate
        energetic_calm: 0,         // Max energetic
        direct_nuanced: 100,       // Max nuanced
      },
    };

    const enriched = brandEnrichmentService.enrichPromptWithToneSliders('Test', extremeBrand);

    expect(enriched).toContain('ton fun et décontracté');
    expect(enriched).toContain('style corporate');
    expect(enriched).toContain('énergie dynamique');
    expect(enriched).toContain('approche nuancée');
  });
});

describe('Brand Kit - Visual Mood Enrichment', () => {
  it('Prompt enrichi avec visual_mood', () => {
    const basePrompt = 'Génère une illustration';
    const enriched = brandEnrichmentService.enrichPromptWithVisualMood(basePrompt, mockBrandKit);

    expect(enriched).toContain('[STYLE VISUEL:');
    expect(enriched).toContain('minimaliste');
    expect(enriched).toContain('tech');
    expect(enriched).toContain('moderne');
  });
});

describe('Brand Kit - Avoid In Visuals Enrichment', () => {
  it('Prompt enrichi avec avoid_in_visuals', () => {
    const basePrompt = 'Crée une photo de bureau';
    const enriched = brandEnrichmentService.enrichPromptWithAvoidInVisuals(basePrompt, mockBrandKit);

    expect(enriched).toContain('[ÉVITER:');
    expect(enriched).toContain('pas de photos de personnes réelles');
    expect(enriched).toContain('éviter le rouge vif');
  });
});

describe('Brand Kit - Full Enrichment', () => {
  it('Enrichissement complet avec tous les éléments', () => {
    const basePrompt = 'Crée un carrousel Instagram sur les meilleures pratiques DevOps';
    const enriched = brandEnrichmentService.fullEnrichment(basePrompt, mockBrandKit);

    // Vérifie présence de tous les blocs
    expect(enriched).toContain('[MARQUE: TechStartup | NICHE: SaaS B2B]');
    expect(enriched).toContain('[PALETTE COULEURS:');
    expect(enriched).toContain('[TONALITÉ:');
    expect(enriched).toContain('[STYLE VISUEL:');
    expect(enriched).toContain('[TYPES DE VISUELS PRÉFÉRÉS:');
    expect(enriched).toContain('[ÉVITER:');

    // Vérifie que le prompt original est préservé
    expect(enriched).toContain('Crée un carrousel Instagram sur les meilleures pratiques DevOps');
  });

  it('Enrichissement partiel si brand kit incomplet', () => {
    const partialBrand: BrandKit = {
      id: 'b1',
      name: 'Partial',
      niche: 'E-commerce',
      palette: { primary: '#FF0000' },
      // Pas de tone_sliders, visual_mood, etc.
    };

    const enriched = brandEnrichmentService.fullEnrichment('Test prompt', partialBrand);

    expect(enriched).toContain('[MARQUE: Partial | NICHE: E-commerce]');
    expect(enriched).toContain('[PALETTE COULEURS:');
    expect(enriched).not.toContain('[TONALITÉ:');
    expect(enriched).not.toContain('[STYLE VISUEL:');
    expect(enriched).not.toContain('[ÉVITER:');
  });
});
