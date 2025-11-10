export type Suggestion = {
  title: string;
  prompt: string;
  ratio: "1:1" | "4:5" | "9:16";
  goal: "awareness" | "lead" | "sale";
};

export const SUGGESTIONS: Suggestion[] = [
  {
    title: "Awareness carré",
    ratio: "1:1",
    goal: "awareness",
    prompt:
      "Créé un visuel 1:1 pour mettre en avant notre nouveau produit SaaS, ton premium mais accessible, CTA 'Découvrir la démo'.",
  },
  {
    title: "Lead gen 4:5",
    ratio: "4:5",
    goal: "lead",
    prompt:
      "Je veux un visuel 4:5 pour une campagne lead magnet 'Guide 2025', ton B2B clair, CTA 'Télécharger le guide'.",
  },
  {
    title: "Carrousel storytelling",
    ratio: "9:16",
    goal: "sale",
    prompt:
      "Prépare un carrousel 9:16 en 5 slides pour raconter notre cas client clé, ton storytelling et CTA 'Parler à un expert'.",
  },
];
