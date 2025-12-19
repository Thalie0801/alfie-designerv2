export type House = "alfie" | "aeditus" | "cap" | "passage42";

export const HOUSES: Record<House, {
  label: string;
  tagline: string;
  cta: string;
  primaryRoute: string;
}> = {
  alfie: {
    label: "Alfie Designer",
    tagline: "Crée tes visuels comme un studio.",
    cta: "Créer mes designs",
    primaryRoute: "/alfie",
  },
  aeditus: {
    label: "Aeditus",
    tagline: "Ta stratégie + planification.",
    cta: "Optimiser mon planning",
    primaryRoute: "/aeditus",
  },
  cap: {
    label: "Cap sur tes Réseaux",
    tagline: "Formation & accompagnement.",
    cta: "Booster ma croissance",
    primaryRoute: "/cap",
  },
  passage42: {
    label: "Le Passage 42",
    tagline: "L’univers à collectionner.",
    cta: "Découvrir la boutique",
    primaryRoute: "/passage42",
  },
};
