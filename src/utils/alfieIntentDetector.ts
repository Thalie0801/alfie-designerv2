import { QUICK_INTENTS } from '@/config/alfieAI';

export interface DetectedIntent {
  type: 'open_canva' | 'show_brandkit' | 'check_credits' | 'browse_templates' | 'unknown';
  confidence: number;
  params?: Record<string, any>;
}

/**
 * Détecte l'intention de l'utilisateur sans appeler l'IA
 * Permet de gérer les actions simples en local (économie de coûts)
 */
export function detectIntent(userMessage: string): DetectedIntent {
  const msg = userMessage.toLowerCase().trim();

  // Open Canva
  if (QUICK_INTENTS.openCanva.test(msg)) {
    return { type: 'open_canva', confidence: 0.9 };
  }

  // Show Brand Kit
  if (QUICK_INTENTS.showBrandKit.test(msg)) {
    return { type: 'show_brandkit', confidence: 0.9 };
  }

  // Check credits
  if (QUICK_INTENTS.checkCredits.test(msg)) {
    return { type: 'check_credits', confidence: 0.9 };
  }

  // Browse templates avec catégorie détectée
  if (QUICK_INTENTS.socialMedia.test(msg)) {
    return { 
      type: 'browse_templates', 
      confidence: 0.85,
      params: { category: 'social_media' }
    };
  }

  if (QUICK_INTENTS.marketing.test(msg)) {
    return { 
      type: 'browse_templates', 
      confidence: 0.85,
      params: { category: 'marketing' }
    };
  }

  if (QUICK_INTENTS.ecommerce.test(msg)) {
    return { 
      type: 'browse_templates', 
      confidence: 0.85,
      params: { category: 'ecommerce' }
    };
  }

  // Aucune intention détectée → passe à l'IA
  return { type: 'unknown', confidence: 0 };
}

/**
 * Vérifie si le message peut être géré sans IA (short call)
 */
export function canHandleLocally(intent: DetectedIntent): boolean {
  return intent.confidence >= 0.85 && intent.type !== 'unknown';
}

/**
 * Génère une réponse rapide locale si possible
 */
export function generateLocalResponse(intent: DetectedIntent): string | null {
  switch (intent.type) {
    case 'open_canva':
      return "Pour ouvrir un template dans Canva, choisis d'abord un template que je vais te proposer ! 🎨";
    
    case 'show_brandkit':
      return "Je vais te montrer ton Brand Kit actuel 🐾";
    
    case 'check_credits':
      return "Je vérifie ton solde de crédits IA ✨";
    
    default:
      return null;
  }
}
