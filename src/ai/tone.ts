import type { AlfieIntent } from "./intent";

type TonePackId = AlfieIntent["tone_pack"];

type TonePack = {
  id: TonePackId;
  label: string;
  description: string;
  systemHint: string;
};

const tonePacks: Record<TonePackId, TonePack> = {
  brand_default: {
    id: "brand_default",
    label: "Voix de marque",
    description: "Respecte la voix définie dans le Brand Kit.",
    systemHint:
      "Adopte la voix officielle de la marque. Reste aligné avec les éléments fournis (voix, niche, valeurs).",
  },
  apple_like: {
    id: "apple_like",
    label: "Apple-like",
    description: "Minimaliste, premium et inspirant.",
    systemHint: "Ton premium, phrases courtes, focus sur l'expérience utilisateur et l'émotion.",
  },
  playful: {
    id: "playful",
    label: "Playful",
    description: "Énergique, fun et léger.",
    systemHint: "Utilise un ton positif, friendly, avec des tournures enthousiastes et accessibles.",
  },
  b2b_crisp: {
    id: "b2b_crisp",
    label: "B2B Crisp",
    description: "Professionnel, clair et orienté ROI.",
    systemHint: "Ton clair et direct, orienté bénéfices business, sans jargon inutile.",
  },
};

export function getTonePack(pack: TonePackId): TonePack {
  return tonePacks[pack];
}

export function describeTone(pack: TonePackId): string {
  return tonePacks[pack]?.description ?? tonePacks.brand_default.description;
}

export const TONE_PACKS: TonePack[] = Object.values(tonePacks);
