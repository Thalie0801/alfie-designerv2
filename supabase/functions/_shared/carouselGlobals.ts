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
  title: { min: 10, max: 40 },
  subtitle: { min: 20, max: 70 },
  punchline: { min: 20, max: 60 },
  bullet: { min: 10, max: 44 },
  kpi_label: { min: 5, max: 22 },
  kpi_delta: { min: 2, max: 8 },
  cta: { min: 8, max: 22 },
  note: { min: 50, max: 120 }
};

export const DEFAULT_GLOBALS: CarouselGlobals = {
  audience: "Directeurs Marketing & studios internes",
  promise: "Des visuels toujours on-brand, plus vite.",
  cta: "Rejoindre l'accès anticipé",
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
