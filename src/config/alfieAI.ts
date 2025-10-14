// Configuration flexible du moteur IA pour Alfie
// Permet de switcher facilement entre Gemini, OpenAI, Mistral

export type AIProvider = 'gemini' | 'openai' | 'mistral';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  endpoint: string;
  costPerRequest?: number; // Coût estimé en centimes
}

// Configuration active (facile à changer)
export const ACTIVE_AI_CONFIG: AIModelConfig = {
  provider: 'gemini',
  model: 'google/gemini-2.5-flash',
  endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
  costPerRequest: 0.05 // 0.05€ estimé par requête
};

// Configurations alternatives prêtes à l'emploi
export const AI_CONFIGS: Record<AIProvider, AIModelConfig> = {
  gemini: {
    provider: 'gemini',
    model: 'google/gemini-2.5-flash',
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    costPerRequest: 0.05
  },
  openai: {
    provider: 'openai',
    model: 'openai/gpt-5-mini',
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    costPerRequest: 0.15
  },
  mistral: {
    provider: 'mistral',
    model: 'mistral/mistral-medium', // À adapter selon disponibilité
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    costPerRequest: 0.08
  }
};

// Fonction utilitaire pour changer de provider
export function switchAIProvider(provider: AIProvider): AIModelConfig {
  return AI_CONFIGS[provider];
}

// Intent patterns pour détection rapide (évite appels IA inutiles)
export const QUICK_INTENTS = {
  // Détection de demandes simples qui n'ont pas besoin de l'IA
  openCanva: /ouvr(e|ir)|lance|va (dans|sur) canva/i,
  showBrandKit: /montre.*(brand|kit|marque)|affiche.*(couleurs|logo)/i,
  checkCredits: /(combien|check|vérifie).*(crédit|reste)/i,
  showUsage: /(montre|affiche|check).*(quota|usage|consommation|compteur)/i,
  packageDownload: /(télécharge|download|zip|package).*(tout|mes|assets)/i,
  
  // Templates par catégorie (cache possible)
  socialMedia: /instagram|facebook|linkedin|twitter|social/i,
  marketing: /pub|marketing|promo|affiche/i,
  ecommerce: /produit|vente|shop|boutique/i,
};

// Réponses pré-cachées pour les intents communs
export const CACHED_RESPONSES = {
  noBrandKit: "Tu n'as pas encore configuré de Brand Kit 🐾. Va dans les paramètres pour ajouter tes couleurs, logo et typo !",
  noCredits: "Oups, tu n'as plus de crédits IA ! 😅 Va dans Billing pour recharger.",
  quotaReached: "Tu as atteint ton quota mensuel d'Alfie 🐾. Passe à un plan supérieur pour continuer !",
};
