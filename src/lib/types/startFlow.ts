// Types for the /start experience
export type StylePreset = 'pro' | 'pop';

export type Intent = {
  kind: 'pack' | 'carousel' | 'post' | 'story' | 'thumbnail';
  ratio: '4:5' | '1:1' | '9:16';
  slides: number;
  topic: string;
  goal: 'Convertir' | 'Éduquer' | 'Autorité' | 'Engagement' | 'Story';
  cta: 'Commenter' | 'DM' | 'Lien bio' | 'Télécharger' | 'Prendre RDV';
  tone: 'Fun' | 'Pro' | 'Luxe' | 'Cute';
  density: 'airy' | 'balanced' | 'compact';
  stylePreset: StylePreset;
  brandKitId?: string;
  brandLocks: { palette: boolean; fonts: boolean; logo: boolean };
};

export type FlowStep = 'wizard' | 'email_gate' | 'generating' | 'delivery';

export type GeneratedAsset = {
  title: string;
  ratio: string;
  url: string;
  thumbnailUrl: string;
};

export const DEFAULT_INTENT: Intent = {
  kind: 'pack',
  ratio: '4:5',
  slides: 5,
  topic: '',
  goal: 'Convertir',
  cta: 'DM',
  tone: 'Fun',
  density: 'balanced',
  stylePreset: 'pop',
  brandLocks: { palette: true, fonts: true, logo: true },
};
