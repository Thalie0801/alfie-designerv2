import { QUICK_INTENTS } from '@/config/alfieAI';

export interface DetectedIntent {
  type: 'open_canva' | 'show_brandkit' | 'check_credits' | 'show_usage' | 'package_download' | 'browse_templates' | 'generate_image' | 'unknown';
  confidence: number;
  params?: Record<string, any>;
}

/**
 * Détecte si le texte contient une demande de génération d'image
 */
export function wantsImageFromText(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(image|visuel|cover|miniature|photo|illustration|vignette|bannière|banner)\b/.test(t) &&
         !/\b(carrou?ss?el|carousel|vidéo|video|reel|story)\b/i.test(t);
}

/**
 * Détecte l'intention de l'utilisateur sans appeler l'IA
 * Permet de gérer les actions simples en local (économie de coûts)
 */
export function detectIntent(userMessage: string): DetectedIntent {
  const msg = userMessage.toLowerCase().trim();

  // 🚨 PRIORITÉ 1: Si "carrousel" est mentionné, on passe TOUJOURS à l'IA
  if (/(carrousel|carousel|slides?|série|diaporama)/i.test(msg)) {
    return { type: 'unknown', confidence: 0 };
  }

  // Open Canva (maintenant sécurisé après le check carrousel)
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

  // Show usage (nouveaux quotas)
  if (QUICK_INTENTS.showUsage.test(msg)) {
    return { type: 'show_usage', confidence: 0.9 };
  }

  // Package download
  if (QUICK_INTENTS.packageDownload.test(msg)) {
    return { type: 'package_download', confidence: 0.9 };
  }

  // Detect image generation request
  if (wantsImageFromText(msg)) {
    return {
      type: 'generate_image',
      confidence: 0.8,
      params: { prompt: msg }
    };
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
      // Laisser l'IA gérer le contexte (carrousel vs template)
      return null;
    
    case 'show_brandkit':
      return "Je vais te montrer ton Brand Kit actuel 🐾";
    
    case 'check_credits':
      return "Je vérifie ton solde de crédits IA ✨";

    case 'show_usage':
      return "Je regarde tes compteurs de quotas (visuels, vidéos, Woofs) 📊";

    case 'package_download':
      return "Je prépare un package avec tous tes assets ! 📦";
    
    default:
      return null;
  }
}
