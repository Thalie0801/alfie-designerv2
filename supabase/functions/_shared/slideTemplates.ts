// Phase 2: Templates de slides pour carrousels cohérents

export interface SlideTemplate {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
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
