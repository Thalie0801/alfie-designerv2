import type { TourStep } from "./InteractiveTour";

export const STUDIO_STEPS: TourStep[] = [
  {
    selector: '[data-tour-id="chat-widget-bubble"]',
    title: "🎬 Bienvenue dans Alfie !",
    content: "Alfie est ton assistant créatif IA. Discute avec lui pour créer tes visuels : images, carrousels, vidéos. Je vais te montrer comment ça marche !",
    placement: "left",
  },
  {
    selector: '[data-tour-id="chat-widget-bubble"]',
    title: "💬 Comment créer avec Alfie",
    content: "Décris simplement ce que tu veux créer :\n\n• **\"Crée-moi 3 images pour ma promo de Noël\"**\n• **\"Un carrousel sur mes 5 conseils nutrition\"**\n• **\"Une vidéo teaser pour mon nouveau produit\"**\n\nAlfie comprend ta demande et prépare un pack adapté !",
    placement: "left",
  },
  {
    selector: '[data-tour-id="chat-widget-bubble"]',
    title: "🎨 Styles visuels automatiques",
    content: "Alfie détecte automatiquement le style adapté :\n\n• **Fond** : arrière-plans abstraits, dégradés\n• **Personnage** : mascotte 3D style Pixar\n• **Produit** : mise en valeur de ton produit\n\nTu peux ajuster avant de générer !",
    placement: "left",
  },
  {
    selector: '[data-sidebar-id="library"]',
    title: "📚 Ta Bibliothèque",
    content: "Tous tes visuels générés sont rangés ici, classés par type. Tu peux télécharger, copier les textes, ou exporter en CSV pour Canva !",
    placement: "right",
  },
  {
    selector: '[data-tour-id="brand-kit"]',
    title: "🎨 Ton Brand Kit",
    content: "Configure ta marque ici : couleurs, voix, niche, style visuel… Alfie s'en sert pour personnaliser toutes tes créations automatiquement.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="quotas"]',
    title: "🐶 Tes Woofs",
    content: "Les Woofs sont la monnaie d'Alfie :\n\n• **1 Woof** = 1 image\n• **10 Woofs** = 1 carrousel (5 slides)\n• **25 Woofs** = 1 vidéo (6s)\n\nIls se rechargent chaque mois selon ton plan !",
    placement: "top",
  },
  {
    selector: '[data-sidebar-id="affiliate"]',
    title: "🤝 Programme Partenaire",
    content: "Parraine tes amis et gagne 15% de commission sur leurs abonnements. Deviens Créateur, Mentor, puis Leader !",
    placement: "right",
  },
  {
    selector: '[data-tour-id="help-launcher"]',
    title: "✅ C'est parti !",
    content: "Tu peux relancer ce guide à tout moment en cliquant ici. Maintenant, ouvre le chat et dis à Alfie ce que tu veux créer. Bonne création ! 🚀",
    placement: "bottom",
  },
];
