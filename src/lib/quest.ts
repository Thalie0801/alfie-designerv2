import type { House } from './houses';

export type Question = {
  id: string;
  title: string;
  choices: {
    label: string;
    value: number;
    answer: string;
  }[];
};

export const QUEST: Record<House, Question[]> = {
  alfie: [
    {
      id: 'goal',
      title: 'Quel type de création préfères-tu ?',
      choices: [
        { label: 'Carrousel Instagram', value: 3, answer: 'carrousel' },
        { label: 'Pack d’images', value: 2, answer: 'images' },
        { label: 'Vidéo courte', value: 3, answer: 'video_short' },
        { label: 'Présentation 16:9', value: 2, answer: 'slides' },
      ],
    },
    {
      id: 'skill',
      title: 'Ton niveau de maîtrise en design ?',
      choices: [
        { label: 'Débutant', value: 1, answer: 'beginner' },
        { label: 'Intermédiaire', value: 2, answer: 'intermediate' },
        { label: 'Avancé', value: 3, answer: 'advanced' },
        { label: 'Je ne sais pas', value: 1, answer: 'unknown' },
      ],
    },
    {
      id: 'orientation',
      title: 'Quelle orientation cherches‑tu ?',
      choices: [
        { label: 'Performance', value: 3, answer: 'performance' },
        { label: 'Esthétique', value: 2, answer: 'aesthetic' },
        { label: 'Équilibré', value: 2, answer: 'balanced' },
        { label: 'Je ne sais pas', value: 1, answer: 'unsure' },
      ],
    },
    {
      id: 'time',
      title: 'Combien d’heures par semaine consacres‑tu à la création ?',
      choices: [
        { label: 'Moins d’une heure', value: 1, answer: '<1h' },
        { label: '1 à 3 heures', value: 2, answer: '1-3h' },
        { label: '4 à 6 heures', value: 3, answer: '4-6h' },
        { label: '7 heures ou plus', value: 4, answer: '7h+' },
      ],
    },
    {
      id: 'style',
      title: 'Quel style t’inspire le plus ?',
      choices: [
        { label: 'Minimaliste', value: 2, answer: 'minimal' },
        { label: 'Coloré', value: 3, answer: 'colorful' },
        { label: 'Illustratif', value: 3, answer: 'illustrative' },
        { label: 'Photographie', value: 2, answer: 'photo' },
      ],
    },
    {
      id: 'guidance',
      title: 'Préférerais‑tu un guidage étape par étape ?',
      choices: [
        { label: 'Oui', value: 3, answer: 'yes' },
        { label: 'Non', value: 1, answer: 'no' },
        { label: 'Parfois', value: 2, answer: 'sometimes' },
        { label: 'Je ne sais pas', value: 1, answer: 'unsure' },
      ],
    },
  ],
  aeditus: [
    {
      id: 'goal',
      title: 'Quel est ton objectif principal ?',
      choices: [
        { label: 'Planifier mes contenus', value: 3, answer: 'planning' },
        { label: 'Gérer mes campagnes', value: 2, answer: 'campaigns' },
        { label: 'Analyser mes résultats', value: 3, answer: 'analytics' },
        { label: 'Organiser mon équipe', value: 2, answer: 'team' },
      ],
    },
    {
      id: 'experience',
      title: 'Quelle est ton expérience en marketing ?',
      choices: [
        { label: 'Novice', value: 1, answer: 'novice' },
        { label: 'Intermédiaire', value: 2, answer: 'intermediate' },
        { label: 'Expert', value: 3, answer: 'expert' },
        { label: 'Je ne sais pas', value: 1, answer: 'unknown' },
      ],
    },
    {
      id: 'priority',
      title: 'Quelle est ta priorité ?',
      choices: [
        { label: 'Gain de temps', value: 3, answer: 'time' },
        { label: 'Optimisation', value: 2, answer: 'optimization' },
        { label: 'Automatisation', value: 3, answer: 'automation' },
        { label: 'Je ne sais pas', value: 1, answer: 'unsure' },
      ],
    },
    {
      id: 'team',
      title: 'Combien de personnes travaillent avec toi ?',
      choices: [
        { label: '0 (solo)', value: 1, answer: 'solo' },
        { label: '1 à 2', value: 2, answer: 'small' },
        { label: '3 à 5', value: 3, answer: 'medium' },
        { label: '6 ou plus', value: 4, answer: 'large' },
      ],
    },
    {
      id: 'tooling',
      title: 'Quel type d’outils utilises‑tu actuellement ?',
      choices: [
        { label: 'Feuilles de calcul', value: 1, answer: 'spreadsheets' },
        { label: 'Outils SaaS dédiés', value: 3, answer: 'saas' },
        { label: 'Notes papiers', value: 1, answer: 'paper' },
        { label: 'Je ne sais pas', value: 1, answer: 'unsure' },
      ],
    },
    {
      id: 'frequency',
      title: 'Quel rythme de publication vises‑tu ?',
      choices: [
        { label: '1 fois par semaine', value: 1, answer: 'weekly' },
        { label: '2 à 3 fois par semaine', value: 2, answer: 'biweekly' },
        { label: 'Quotidien', value: 3, answer: 'daily' },
        { label: 'Pas défini', value: 1, answer: 'unsure' },
      ],
    },
  ],
  cap: [
    {
      id: 'goal',
      title: 'Quel est ton objectif pour booster tes réseaux ?',
      choices: [
        { label: 'Gagner des followers', value: 3, answer: 'followers' },
        { label: 'Augmenter l’engagement', value: 2, answer: 'engagement' },
        { label: 'Vendre un produit', value: 3, answer: 'sales' },
        { label: 'Construire ma marque', value: 2, answer: 'brand' },
      ],
    },
    {
      id: 'platform',
      title: 'Quelle plateforme priorises‑tu ?',
      choices: [
        { label: 'Instagram', value: 2, answer: 'instagram' },
        { label: 'TikTok', value: 3, answer: 'tiktok' },
        { label: 'LinkedIn', value: 2, answer: 'linkedin' },
        { label: 'Autre', value: 1, answer: 'other' },
      ],
    },
    {
      id: 'content',
      title: 'Quel type de contenu préfères‑tu créer ?',
      choices: [
        { label: 'Photo', value: 2, answer: 'photo' },
        { label: 'Vidéo', value: 3, answer: 'video' },
        { label: 'Texte', value: 1, answer: 'text' },
        { label: 'Mixtes', value: 2, answer: 'mixed' },
      ],
    },
    {
      id: 'budget',
      title: 'Quel budget mensuel investis‑tu en marketing ?',
      choices: [
        { label: '0 ‑ 50 €', value: 1, answer: '0-50' },
        { label: '50 ‑ 100 €', value: 2, answer: '50-100' },
        { label: '100 ‑ 500 €', value: 3, answer: '100-500' },
        { label: '500 + €', value: 4, answer: '500+' },
      ],
    },
    {
      id: 'consistency',
      title: 'Quelle est ta constance de publication actuelle ?',
      choices: [
        { label: 'Rarement', value: 1, answer: 'rare' },
        { label: 'Quelques fois par mois', value: 2, answer: 'occasional' },
        { label: 'Une fois par semaine', value: 3, answer: 'weekly' },
        { label: 'Plusieurs fois par semaine', value: 4, answer: 'often' },
      ],
    },
    {
      id: 'challenge',
      title: 'Quel est ton plus grand défi ?',
      choices: [
        { label: 'Trouver des idées', value: 2, answer: 'ideas' },
        { label: 'Manque de temps', value: 3, answer: 'time' },
        { label: 'Créer du contenu de qualité', value: 3, answer: 'quality' },
        { label: 'Autre', value: 1, answer: 'other' },
      ],
    },
  ],
  passage42: [
    {
      id: 'interest',
      title: 'Qu’est-ce qui t’intéresse le plus dans l’univers ?',
      choices: [
        { label: 'L’aventure', value: 3, answer: 'adventure' },
        { label: 'La collection', value: 2, answer: 'collection' },
        { label: 'La narration', value: 2, answer: 'narration' },
        { label: 'Autre', value: 1, answer: 'other' },
      ],
    },
    {
      id: 'story',
      title: 'Quel type d’histoire préfères-tu ?',
      choices: [
        { label: 'Fantastique', value: 3, answer: 'fantasy' },
        { label: 'Science-fiction', value: 2, answer: 'scifi' },
        { label: 'Historique', value: 2, answer: 'historical' },
        { label: 'Contemporain', value: 1, answer: 'contemporary' },
      ],
    },
    {
      id: 'format',
      title: 'Quel format de contenu t’attire ?',
      choices: [
        { label: 'Texte', value: 1, answer: 'text' },
        { label: 'Audio', value: 2, answer: 'audio' },
        { label: 'Vidéo', value: 3, answer: 'video' },
        { label: 'Interactif', value: 3, answer: 'interactive' },
      ],
    },
    {
      id: 'collectibles',
      title: 'Aimes‑tu collectionner des objets ?',
      choices: [
        { label: 'Oui', value: 3, answer: 'yes' },
        { label: 'Non', value: 1, answer: 'no' },
        { label: 'Parfois', value: 2, answer: 'sometimes' },
        { label: 'Je ne sais pas', value: 1, answer: 'unsure' },
      ],
    },
    {
      id: 'timeInvestment',
      title: 'Combien de temps es‑tu prêt(e) à investir ?',
      choices: [
        { label: 'Moins d’une heure par semaine', value: 1, answer: '<1h' },
        { label: '1 à 3 heures par semaine', value: 2, answer: '1-3h' },
        { label: '4 à 6 heures par semaine', value: 3, answer: '4-6h' },
        { label: 'Plus de 6 heures', value: 4, answer: '6h+' },
      ],
    },
    {
      id: 'community',
      title: 'Veux‑tu rejoindre une communauté ?',
      choices: [
        { label: 'Oui', value: 3, answer: 'yes' },
        { label: 'Non', value: 1, answer: 'no' },
        { label: 'Peutêtre', value: 2, answer: 'maybe' },
        { label: 'Je ne sais pas', value: 1, answer: 'unsure' },
      ],
    },
  ],
};
