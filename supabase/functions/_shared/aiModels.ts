/**
 * Configuration des modèles IA
 * Tous les plans utilisent maintenant Gemini 3 Pro (y compris Starter 39€)
 */

export type AITier = 'standard' | 'premium';

export interface AIModelsConfig {
  text: string;
  image: string;
}

// ✅ Tous les plans utilisent Gemini 3 Pro
export const AI_MODELS: AIModelsConfig = {
  text: 'google/gemini-2.5-pro',
  image: 'google/gemini-3-pro-image-preview',
};

// ✅ Configuration spécifique carrousels (toggle Standard/Premium)
export const CAROUSEL_MODELS = {
  standard: 'google/gemini-2.5-flash-image-preview',  // Rapide + overlay Cloudinary
  premium: 'google/gemini-3-pro-image-preview',       // Texte intégré nativement
};

export type CarouselMode = 'standard' | 'premium';

export function getModelsForPlan(_plan?: string | null, _forcePremium?: boolean): AIModelsConfig {
  // ✅ Tous les plans utilisent les mêmes modèles maintenant
  return AI_MODELS;
}

export function getCarouselModel(mode: CarouselMode): string {
  return CAROUSEL_MODELS[mode] || CAROUSEL_MODELS.standard;
}

export function getModelDescription(_plan?: string | null, _forcePremium?: boolean): string {
  return 'IA Premium (Gemini 3 Pro) - Qualité maximum';
}

/**
 * Tous les utilisateurs ont maintenant accès Premium
 */
export function hasPremiumAccess(_plan?: string | null, _hasPurchasedPacks?: boolean): boolean {
  return true;
}
