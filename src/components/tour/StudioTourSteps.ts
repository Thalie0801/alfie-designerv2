import type { TourStep } from "./InteractiveTour";

export const STUDIO_STEPS: TourStep[] = [
  {
    selector: '[data-tour-id="studio-header"]',
    title: "🎬 Bienvenue dans le Studio !",
    content: "C'est ici que tu construis tes campagnes visuelles sur mesure avec Alfie. Je vais te montrer comment ça marche.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-brief"]',
    title: "📝 Ton brief de campagne",
    content: "Commence par décrire ce que tu veux créer : nom de la campagne, offre, cible, ton, plateforme… Alfie s'en servira pour te proposer un pack adapté.",
    placement: "right",
  },
  {
    selector: '[data-tour-id="studio-brandkit"]',
    title: "🎨 Ton Brand Kit",
    content: "Choisis la marque pour cette campagne. Alfie utilisera ses couleurs, sa voix et son style pour personnaliser tous tes visuels.",
    placement: "right",
  },
  {
    selector: '[data-tour-id="studio-assets"]',
    title: "📦 Tes visuels",
    content: "Ici tu vois tous les visuels de ta campagne : images, carrousels, vidéos. Tu peux les ajouter, les modifier ou les supprimer avant de lancer.",
    placement: "left",
  },
  {
    selector: '[data-tour-id="studio-propose-pack"]',
    title: "✨ Laisse Alfie proposer",
    content: "Tu peux laisser Alfie te proposer un pack complet à partir de ton brief. Il analysera ta demande et construira un pack adapté que tu pourras ajuster.",
    placement: "top",
  },
  {
    selector: '[data-tour-id="studio-woofs-recap"]',
    title: "🐶 Récap Woofs",
    content: "Les Woofs sont la petite monnaie d'Alfie. Ici tu vois le coût de ton pack, tes Woofs disponibles, et ce que tu vas créer.",
    placement: "left",
  },
  {
    selector: '[data-tour-id="studio-launch"]',
    title: "🚀 Lance ta génération",
    content: "Quand tout te convient, clique ici pour lancer la génération. Alfie prépare tes visuels et tu les retrouves dans la bibliothèque.",
    placement: "top",
  },
  {
    selector: '[data-tour-id="chat-widget-bubble"]',
    title: "💬 Discute avec Alfie",
    content: "Tu peux aussi discuter avec Alfie ici :\n\n• **Coach Stratégie** t'aide à clarifier ton offre\n• **DA junior** t'aide sur le style créatif\n• **Réalisateur Studio** te propose des packs prêts à générer\n\nPose-lui tes questions, Alfie est là comme un coéquipier créatif !",
    placement: "left",
  },
  {
    selector: '[data-sidebar-id="library"]',
    title: "📚 Retrouve tes créations",
    content: "Tes images, carrousels et vidéos générés seront rangés dans la bibliothèque, classés par type. Bon design !",
    placement: "right",
  },
];
