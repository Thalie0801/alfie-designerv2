import type { TourStep } from "./InteractiveTour";

/**
 * Tour étapes pour Studio Solo (/studio)
 * Guide utilisateur pour la création d'un élément unique
 */
export const STUDIO_SOLO_STEPS: TourStep[] = [
  {
    selector: '[data-tour-id="studio-header"]',
    title: "🎬 Studio Solo",
    content: "Bienvenue ! Ici tu crées **1 élément à la fois** : une image, un carrousel ou une vidéo.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-image-card"]',
    title: "🖼️ Créer une Image",
    content: "1 image = 1 Woof. Choisis ta plateforme (Instagram, Pinterest, YouTube...) et le format adapté.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-carousel-card"]',
    title: "🎠 Créer un Carrousel",
    content: "1 carrousel = 10 Woofs (5 slides). Parfait pour les listes, conseils, tutoriels.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-video-card"]',
    title: "✨ Créer une Vidéo",
    content: "1 vidéo = 25 Woofs. Génère un reel animé de 6-8 secondes.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-platform-select"]',
    title: "📱 Plateforme",
    content: "Instagram, TikTok, LinkedIn, Pinterest, YouTube... Chaque plateforme a ses formats optimisés.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-brandkit-toggle"]',
    title: "🎨 Brand Kit",
    content: "Active cette option pour que tes visuels respectent automatiquement les couleurs et le style de ta marque.",
    placement: "right",
  },
  {
    selector: '[data-tour-id="help-launcher"]',
    title: "✅ C'est parti !",
    content: "Tu peux relancer ce guide à tout moment. Décris ton visuel et lance la génération !",
    placement: "bottom",
  },
];

/**
 * Tour étapes pour Studio Multi (/studio/multi)
 * Guide utilisateur pour les packs et campagnes
 */
export const STUDIO_MULTI_STEPS: TourStep[] = [
  {
    selector: '[data-tour-id="studio-multi-header"]',
    title: "📦 Studio Multi",
    content: "Bienvenue ! Ici tu crées des **packs complets** : mini-films ou campagnes multi-assets.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-multi-presets"]',
    title: "🚀 Packs prédéfinis",
    content: "Utilise les packs prédéfinis (Lancement, Evergreen, Promo) pour gagner du temps !",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="studio-multi-tabs"]',
    title: "🎬 Deux modes",
    content: "**Mini-Film** : vidéos multi-clips enchaînés.\n\n**Pack Campagne** : mix images + carrousels + vidéos.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="mini-film-tab"]',
    title: "🎬 Mini-Film",
    content: "Crée une vidéo avec plusieurs clips enchaînés. Idéal pour les teasers et storytelling.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="pack-campaign-tab"]',
    title: "📦 Pack Campagne",
    content: "Combine images + carrousels + vidéos en un seul pack cohérent.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="help-launcher"]',
    title: "✅ C'est parti !",
    content: "Tu peux relancer ce guide à tout moment. Bonne création !",
    placement: "bottom",
  },
];

// Legacy export for compatibility
export const STUDIO_STEPS = STUDIO_SOLO_STEPS;
