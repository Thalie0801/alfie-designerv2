// Phase 2: Templates de slides pour carrousels cohérents avec contraintes éditoriales

export interface SlideTemplate {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
  requiredFields: string[];
  optionalFields: string[];
  charLimits: Record<string, { min: number; max: number }>;
  layout: {
    width: number;
    height: number;
    safeZones: { top: number; bottom: number; left: number; right: number };
  };
  textLayers: TextLayer[];
  logoZone: { x: number; y: number; width: number; height: number };
}

export interface TextLayer {
  id: string;
  type: 'title' | 'subtitle' | 'bullet' | 'cta' | 'badge' | 'kpi';
  font: string;
  size: number;
  weight: number;
  color: string;
  position: { x: number; y: number };
  maxWidth: number;
  maxLines: number;
  align: 'left' | 'center' | 'right';
}

export const SLIDE_TEMPLATES: Record<string, SlideTemplate> = {
  hero: {
    type: 'hero',
    requiredFields: ['title', 'cta_primary'],
    optionalFields: ['subtitle', 'punchline', 'badge'],
    charLimits: {
      title: { min: 10, max: 40 },
      subtitle: { min: 20, max: 60 },  // ✅ Réduit de 70 à 60 pour cohérence
      punchline: { min: 20, max: 60 },
      cta_primary: { min: 8, max: 22 },
      badge: { min: 5, max: 30 },
    },
    layout: { 
      width: 1080, 
      height: 1350, 
      safeZones: { top: 80, bottom: 120, left: 60, right: 60 } 
    },
    textLayers: [
      { 
        id: 'title', 
        type: 'title', 
        font: 'Inter', 
        size: 72, 
        weight: 700, 
        color: '#000000', 
        position: { x: 60, y: 200 }, 
        maxWidth: 960, 
        maxLines: 2, 
        align: 'left' 
      },
      { 
        id: 'subtitle', 
        type: 'subtitle', 
        font: 'Inter', 
        size: 32, 
        weight: 400, 
        color: '#666666',
        position: { x: 60, y: 400 }, 
        maxWidth: 960, 
        maxLines: 3, 
        align: 'left' 
      },
      { 
        id: 'punchline', 
        type: 'subtitle', 
        font: 'Inter', 
        size: 28, 
        weight: 500, 
        color: '#333333',
        position: { x: 60, y: 600 }, 
        maxWidth: 960, 
        maxLines: 2, 
        align: 'left' 
      },
      { 
        id: 'cta', 
        type: 'cta', 
        font: 'Inter', 
        size: 28, 
        weight: 600, 
        color: '#FFFFFF',
        position: { x: 540, y: 1100 }, 
        maxWidth: 300, 
        maxLines: 1, 
        align: 'center' 
      },
      { 
        id: 'badge', 
        type: 'badge', 
        font: 'Inter', 
        size: 20, 
        weight: 600, 
        color: '#10B981',
        position: { x: 60, y: 900 }, 
        maxWidth: 200, 
        maxLines: 1, 
        align: 'left' 
      }
    ],
    logoZone: { x: 900, y: 1200, width: 120, height: 120 }
  },
  
  problem: {
    type: 'problem',
    requiredFields: ['title', 'bullets'],
    optionalFields: [],
    charLimits: {
      title: { min: 10, max: 40 },
      bullet: { min: 10, max: 44 },
    },
    layout: { 
      width: 1080, 
      height: 1350, 
      safeZones: { top: 80, bottom: 120, left: 60, right: 60 } 
    },
    textLayers: [
      { 
        id: 'title', 
        type: 'title', 
        font: 'Inter', 
        size: 64, 
        weight: 700, 
        color: '#000000', 
        position: { x: 60, y: 150 }, 
        maxWidth: 960, 
        maxLines: 3, 
        align: 'left' 
      }
    ],
    logoZone: { x: 900, y: 1200, width: 120, height: 120 }
  },
  
  solution: {
    type: 'solution',
    requiredFields: ['title', 'bullets'],
    optionalFields: [],
    charLimits: {
      title: { min: 10, max: 40 },
      bullet: { min: 10, max: 44 },
    },
    layout: { 
      width: 1080, 
      height: 1350, 
      safeZones: { top: 80, bottom: 120, left: 60, right: 60 } 
    },
    textLayers: [
      { 
        id: 'title', 
        type: 'title', 
        font: 'Inter', 
        size: 64, 
        weight: 700, 
        color: '#000000', 
        position: { x: 60, y: 150 }, 
        maxWidth: 960, 
        maxLines: 3, 
        align: 'left' 
      }
    ],
    logoZone: { x: 900, y: 1200, width: 120, height: 120 }
  },
  
  impact: {
    type: 'impact',
    requiredFields: ['title', 'kpis'],
    optionalFields: [],
    charLimits: {
      title: { min: 10, max: 40 },
      kpi_label: { min: 5, max: 22 },
      kpi_delta: { min: 2, max: 8 },
    },
    layout: { 
      width: 1080, 
      height: 1350, 
      safeZones: { top: 80, bottom: 120, left: 60, right: 60 } 
    },
    textLayers: [
      { 
        id: 'title', 
        type: 'title', 
        font: 'Inter', 
        size: 64, 
        weight: 700, 
        color: '#000000', 
        position: { x: 60, y: 150 }, 
        maxWidth: 960, 
        maxLines: 2, 
        align: 'left' 
      }
    ],
    logoZone: { x: 900, y: 1200, width: 120, height: 120 }
  },
  
  cta: {
    type: 'cta',
    requiredFields: ['title', 'cta_primary'],
    optionalFields: ['subtitle', 'cta_secondary', 'note'],
    charLimits: {
      title: { min: 10, max: 40 },
      subtitle: { min: 20, max: 60 },  // ✅ Réduit de 70 à 60 pour cohérence
      cta_primary: { min: 8, max: 22 },
      cta_secondary: { min: 8, max: 22 },
      note: { min: 50, max: 120 },
    },
    layout: { 
      width: 1080, 
      height: 1350, 
      safeZones: { top: 80, bottom: 120, left: 60, right: 60 } 
    },
    textLayers: [
      { 
        id: 'title', 
        type: 'title', 
        font: 'Inter', 
        size: 64, 
        weight: 700, 
        color: '#000000', 
        position: { x: 60, y: 300 }, 
        maxWidth: 960, 
        maxLines: 2, 
        align: 'left' 
      },
      { 
        id: 'subtitle', 
        type: 'subtitle', 
        font: 'Inter', 
        size: 32, 
        weight: 400, 
        color: '#666666',
        position: { x: 60, y: 500 }, 
        maxWidth: 960, 
        maxLines: 2, 
        align: 'left' 
      },
      { 
        id: 'cta_primary', 
        type: 'cta', 
        font: 'Inter', 
        size: 28, 
        weight: 600, 
        color: '#FFFFFF',
        position: { x: 540, y: 800 }, 
        maxWidth: 400, 
        maxLines: 1, 
        align: 'center' 
      },
      { 
        id: 'cta_secondary', 
        type: 'cta', 
        font: 'Inter', 
        size: 24, 
        weight: 500, 
        color: '#000000',
        position: { x: 540, y: 920 }, 
        maxWidth: 400, 
        maxLines: 1, 
        align: 'center' 
      },
      { 
        id: 'note', 
        type: 'subtitle', 
        font: 'Inter', 
        size: 18, 
        weight: 400, 
        color: '#999999',
        position: { x: 540, y: 1050 }, 
        maxWidth: 900, 
        maxLines: 2, 
        align: 'center' 
      }
    ],
    logoZone: { x: 900, y: 1200, width: 120, height: 120 }
  }
};
