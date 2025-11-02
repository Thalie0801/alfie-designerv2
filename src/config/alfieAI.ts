// Configuration flexible du moteur IA pour Alfie
// Permet de switcher facilement entre Gemini, OpenAI
// Architecture avec fallback intelligent

export type AIProvider = 'gemini' | 'openai';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  endpoint: string;
  costPerRequest?: number; // Coût estimé en centimes
  specialization?: string; // Domaine d'excellence
}

// Configuration active (facile à changer)
export const ACTIVE_AI_CONFIG: AIModelConfig = {
  provider: 'gemini',
  model: 'google/gemini-2.5-flash',
  endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
  costPerRequest: 0.05,
  specialization: 'Génération visuelle, multimodal, Brand Kit'
};

// Configurations alternatives prêtes à l'emploi
export const AI_CONFIGS: Record<AIProvider, AIModelConfig> = {
  gemini: {
    provider: 'gemini',
    model: 'google/gemini-2.5-flash',
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    costPerRequest: 0.05,
    specialization: 'Génération visuelle, multimodal, Brand Kit, composition détaillée'
  },
  openai: {
    provider: 'openai',
    model: 'openai/gpt-5-mini',
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    costPerRequest: 0.15,
    specialization: 'Raisonnement structuré, analyse complexe, JSON structuré'
  }
};

// Fonction utilitaire pour changer de provider
export function switchAIProvider(provider: AIProvider): AIModelConfig {
  return AI_CONFIGS[provider];
}

// Fonction pour sélectionner le meilleur provider selon le type de tâche
export function selectProviderForTask(taskType: 'image' | 'carousel' | 'video' | 'reasoning'): AIProvider {
  switch (taskType) {
    case 'image':
    case 'carousel':
    case 'video':
      return 'gemini'; // Gemini excelle en génération visuelle
    case 'reasoning':
      return 'openai'; // OpenAI excelle en raisonnement
    default:
      return 'gemini'; // Default fallback
  }
}

// Intent patterns pour détection rapide (évite appels IA inutiles)
export const QUICK_INTENTS = {
  // Détection de demandes simples qui n'ont pas besoin de l'IA
  openCanva: /\b(ouvr(e|ir)|lance)\s+(dans|sur)?\s*canva\b/i,
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
