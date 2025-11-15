import type { ReactNode } from "react";

export type VariantInput = {
  topic?: string;
  cta?: string;
  niche?: string;
};

export type CarouselOutline = {
  title: string;
  slides: string[];
};

// ———————————————————————————————————————
// Helpers
// ———————————————————————————————————————

function pickBySeed<T>(items: T[], seed: number): T {
  if (items.length === 0) {
    throw new Error("pickBySeed: empty list");
  }
  const index = Math.abs(seed) % items.length;
  return items[index];
}

function normalizeTopic(raw?: string): string {
  const topic = (raw ?? "").trim();
  return topic || "ton sujet";
}

function labelForNiche(niche?: string): string {
  if (!niche) return "ton audience";
  const n = niche.toLowerCase();

  if (n.includes("coach")) return "tes clients en coaching";
  if (n.includes("e-com") || n.includes("ecom") || n.includes("boutique")) {
    return "tes clients e-commerce";
  }
  if (n.includes("vdi") || n.includes("mlm")) {
    return "tes filleuls / ton réseau VDI";
  }
  if (n.includes("bon plan") || n.includes("bons plans")) {
    return "ton audience bons plans";
  }

  return "ton audience";
}

// ———————————————————————————————————————
//  CARROUSELS : structures variées
// ———————————————————————————————————————

type CarouselBuilder = (params: { topic: string; nicheLabel: string; slides: number }) => CarouselOutline;

const CAROUSEL_STRUCTURES: CarouselBuilder[] = [
  // 1. Problème → Solution
  ({ topic, nicheLabel }) => ({
    title: "Problème → Solution",
    slides: [
      `Intro : le problème que rencontre ${nicheLabel}`,
      `Pourquoi "${topic}" est un vrai blocage`,
      "Ce qui se passe si on ne change rien",
      `La méthode / solution que tu proposes`,
      "CTA : passe à l’action (comment travailler avec toi)",
    ],
  }),

  // 2. 5 erreurs
  ({ topic }) => ({
    title: "5 erreurs à éviter",
    slides: [
      `Hook : tu fais sûrement ces erreurs avec "${topic}"`,
      "Erreur 1",
      "Erreur 2",
      "Erreur 3 + 4 (en mode rapide)",
      "Erreur 5 + CTA pour corriger tout ça",
    ],
  }),

  // 3. Mythes vs réalité
  ({ topic }) => ({
    title: "Mythes vs réalité",
    slides: [
      `Intro : 3 idées fausses sur "${topic}"`,
      "Mythe 1 → Réalité 1",
      "Mythe 2 → Réalité 2",
      "Mythe 3 → Réalité 3",
      "Conclusion + CTA : passer à la bonne approche",
    ],
  }),

  // 4. Checklist
  ({ topic }) => ({
    title: "Checklist prête à l’emploi",
    slides: [
      `Intro : la checklist pour réussir "${topic}"`,
      "Étape 1",
      "Étape 2",
      "Étape 3",
      "Dernière étape + CTA : garde le post / passe à l’action",
    ],
  }),

  // 5. Avant / Après
  ({ topic, nicheLabel }) => ({
    title: "Avant / Après",
    slides: [
      `Intro : à quoi ressemble "${topic}" AVANT / APRÈS`,
      `Slide AVANT : situation actuelle de ${nicheLabel}`,
      "Slide APRÈS : ce que tu veux pour eux",
      "Comment tu les accompagnes dans cette transformation",
      "CTA : passe du AVANT au APRÈS avec toi",
    ],
  }),
];

export function chooseCarouselOutline(slides: number, seed: number): CarouselOutline {
  // Pour l’instant, Alfie ne reçoit pas encore le topic spécifique ici,
  // donc on génère des structures génériques autour de "ton sujet".
  const topic = normalizeTopic(undefined);
  const nicheLabel = "ton audience";

  const builder = pickBySeed(CAROUSEL_STRUCTURES, seed);
  const base = builder({ topic, nicheLabel, slides });

  if (slides > base.slides.length) {
    const extraCount = slides - base.slides.length;
    const extras: string[] = [];
    for (let i = 0; i < extraCount; i++) {
      extras.push(`Slide bonus : exemple concret / mini étude de cas #${i + 1}`);
    }
    return {
      title: base.title,
      slides: [...base.slides.slice(0, slides - extras.length), ...extras],
    };
  }

  return {
    title: base.title,
    slides: base.slides.slice(0, slides),
  };
}

// ———————————————————————————————————————
//  IMAGES : variantes DA
// ———————————————————————————————————————

export function chooseImageVariant(input: VariantInput, seed: number): ReactNode {
  const topic = normalizeTopic(input.topic);
  const nicheLabel = labelForNiche(input.niche);
  const cta = input.cta ?? "Découvre le détail dans la légende.";

  const variants: ReactNode[] = [
    // Hook simple
    <div className="text-sm space-y-1">
      <p>
        <strong>Visuel hook :</strong> gros titre avec "{topic}" en avant-plan.
      </p>
      <p>Fond simple, couleurs Alfie, focus sur la promesse.</p>
      <p>
        Cible : <em>{nicheLabel}</em>. CTA dans la légende : {cta}
      </p>
    </div>,

    // Liste / bullet points
    <div className="text-sm space-y-1">
      <p>
        <strong>Visuel liste :</strong> 3 à 5 bullet points clés sur "{topic}".
      </p>
      <p>Icônes minimalistes, beaucoup d’espace blanc, super lisible.</p>
      <p>CTA discret dans un bandeau en bas.</p>
    </div>,

    // Avant / Après
    <div className="text-sm space-y-1">
      <p>
        <strong>Visuel avant / après :</strong> à gauche la situation actuelle, à droite le résultat souhaité sur "
        {topic}".
      </p>
      <p>Idéal pour montrer la transformation que tu proposes.</p>
    </div>,
  ];

  return pickBySeed(variants, seed);
}

// ———————————————————————————————————————
//  VIDÉOS : idées de script rapides
// ———————————————————————————————————————

export function chooseVideoVariant(input: VariantInput, seed: number): ReactNode {
  const topic = normalizeTopic(input.topic);
  const nicheLabel = labelForNiche(input.niche);
  const cta = input.cta ?? "Abonne-toi / lien en bio pour aller plus loin.";

  const variants: ReactNode[] = [
    // Script 1 : face cam
    <div className="text-sm space-y-1">
      <p>
        <strong>Script 1 (face cam) :</strong> "Tu galères avec {topic} ? Laisse-moi te montrer 3 choses que{" "}
        {nicheLabel} oublient tout le temps..."
      </p>
      <p>Plan rapide : hook, 3 points, CTA final : {cta}</p>
    </div>,

    // Script 2 : B-roll + texte
    <div className="text-sm space-y-1">
      <p>
        <strong>Script 2 (B-roll + texte) :</strong> séquences de ton quotidien + texte à l’écran avec 3 tips rapides
        sur "{topic}".
      </p>
      <p>Idéal pour Reels / TikTok silencieux.</p>
    </div>,

    // Script 3 : Avant / Après
    <div className="text-sm space-y-1">
      <p>
        <strong>Script 3 (avant / après) :</strong> "Voici à quoi ressemble {topic} AVANT / APRÈS quand on applique la
        bonne méthode..."
      </p>
      <p>Montre concrètement le résultat et termine par : {cta}</p>
    </div>,
  ];

  return pickBySeed(variants, seed);
}
