// Système de globals et schéma JSON normalisé pour carrousels

export interface CarouselGlobals {
  audience: string;
  promise: string;
  cta: string;
  terminology: string[];
  banned: string[];
}

export interface SlideContent {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
  title: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  badge?: string;
  kpis?: Array<{ label: string; delta: string }>;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
}

export interface CarouselPlan {
  globals: CarouselGlobals;
  slides: SlideContent[];
  captions: string[];
}

export const CHAR_LIMITS = {
  title: { min: 15, max: 60 },
  subtitle: { min: 25, max: 100 },
  punchline: { min: 25, max: 80 },
  bullet: { min: 15, max: 60 },
  kpi_label: { min: 8, max: 30 },
  kpi_delta: { min: 2, max: 12 },
  cta: { min: 10, max: 30 },
  note: { min: 80, max: 180 }
};

export const DEFAULT_GLOBALS: CarouselGlobals = {
  audience: "Directeurs Marketing & studios internes",
  promise: "Des visuels toujours on-brand, plus vite.",
  cta: "Essayer Alfie",
  terminology: [
    "cohérence de marque",
    "variantes",
    "garde-fous",
    "workflows",
    "DA assisté par IA"
  ],
  banned: [
    "révolutionnaire",
    "magique",
    "illimité",
    "IA tout-en-un",
    "incroyable",
    "révolution"
  ]
};
