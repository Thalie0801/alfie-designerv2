import type { AlfieIntent } from "./intent";

type TemplateId = string;

type TemplateDefinition = {
  id: TemplateId;
  label: string;
  ratios: AlfieIntent["ratio"][];
  description: string;
};

const templates: TemplateDefinition[] = [
  {
    id: "classic_hero",
    label: "Hero minimal",
    ratios: ["1:1", "4:5", "9:16"],
    description: "Visuel centré avec zone CTA bas, adapté aux posts produit.",
  },
  {
    id: "carousel_story",
    label: "Carrousel storytelling",
    ratios: ["9:16", "4:5"],
    description: "Structure 5 slides avec progression problème → solution → CTA.",
  },
  {
    id: "video_pulse",
    label: "Vidéo punchy",
    ratios: ["9:16", "16:9"],
    description: "Séquence dynamique pour reels ou ads awareness.",
  },
];

export function listTemplates(): TemplateDefinition[] {
  return templates;
}

export function findTemplate(id: TemplateId | null | undefined): TemplateDefinition | undefined {
  if (!id) return undefined;
  return templates.find((template) => template.id === id);
}
