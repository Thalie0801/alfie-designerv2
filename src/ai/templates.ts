import type { AlfieIntent } from "./intent";

export const Templates = {
  recapBeforeLaunch(intent: AlfieIntent) {
    return [
      "**Récap de ta création**",
      `• Format: ${intent.ratio} • Objectif: ${intent.goal}`,
      `• Template: ${intent.templateId ?? "—"}`,
      `• Contenu: "${intent.copyBrief}"`,
      "",
      "Tout est bon ? → [ Oui, lancer ]  [ Modifier ]",
    ].join("\n");
  },

  confirmAfterEnqueue(orderId: string, studioUrl: string, libraryUrl: string) {
    return [
      "🚀 Génération lancée !",
      `• Référence: ${orderId}`,
      `• Suivre l’avancement: [ Voir Studio ](${studioUrl})  |  [ Voir Bibliothèque ](${libraryUrl})`,
      "",
      "Astuce: tu peux continuer à me briefer pendant que ça tourne.",
    ].join("\n");
  },

  unavailable(action: "video" | "image" | "carousel", suggestImage: boolean = true) {
    const alt = suggestImage ? "\n2) Proposer un format image 1:1 équivalent tout de suite" : "";
    return [
      "Cette action n’est pas encore active. Je peux:",
      "1) Mettre la demande en file et la traiter dès activation",
      alt,
    ]
      .filter(Boolean)
      .join("\n");
  },

  statusQueued(studioUrl: string) {
    return `En cours de rendu ⏳ — tu peux suivre ici : [Studio](${studioUrl}). Je te ping dès qu’une vignette arrive.`;
  },

  statusDone(previewUrl: string, downloadUrl?: string) {
    const links = [`[Ouvrir l’aperçu](${previewUrl})`];
    if (downloadUrl) links.push(`[Télécharger](${downloadUrl})`);
    return `C’est prêt ! ${links.join(" | ")}`;
  },

  statusError(shortError: string) {
    return `Il y a eu un blocage (‘${shortError}’). Je réessaie ou on adapte ? [Relancer] [Changer format]`;
  },
};
export default Templates;
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
