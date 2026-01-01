/**
 * Configuration des modèles IA
 * 
 * ARCHITECTURE:
 * - Priorité 1: Vertex AI Gemini 2.5 (utilise crédits Google Cloud)
 * - Priorité 2: Lovable AI (fallback uniquement)
 * 
 * MARGE CIBLE: 80%+ sur toutes les générations
 */

export type AITier = 'standard' | 'premium';
export type CarouselMode = 'standard' | 'premium';

export interface AIModelsConfig {
  text: string;
  image: string;
}

// ============================================
// VERTEX AI MODELS (Priorité 1 - Google Cloud)
// ============================================
export const VERTEX_MODELS = {
  // Chat / Conversation
  text_chat: 'gemini-2.5-pro',
  
  // Génération de textes (économique)
  text_generate: 'gemini-2.5-flash-preview-05-20',
  text_proofread: 'gemini-2.5-flash-lite-preview-06-17',
  
  // Images - Imagen 3 (API /predict sur us-central1)
  image_standard: 'imagen-3.0-generate-002',      // ✅ Imagen 3 Fast
  image_premium: 'imagen-3.0-generate-001',       // ✅ Imagen 3 Premium (qualité max)
  
  // Vidéos
  video: 'veo-3.0-fast-generate-001',
};

// ============================================
// LOVABLE AI MODELS (Fallback uniquement)
// ============================================
export const LOVABLE_MODELS = {
  text: 'google/gemini-2.5-flash',
  image_standard: 'google/gemini-2.5-flash-image-preview',
  image_premium: 'google/gemini-3-pro-image-preview',
};

// ✅ Configuration par défaut (Lovable AI - sera overridé par Vertex si configuré)
export const AI_MODELS: AIModelsConfig = {
  text: LOVABLE_MODELS.text,
  image: LOVABLE_MODELS.image_premium,
};

// ✅ Configuration carrousels
// ✅ Tous les carrousels utilisent Nano Banana Pro pour qualité uniforme
export const CAROUSEL_MODELS = {
  standard: LOVABLE_MODELS.image_premium,  // Migré vers Nano Banana Pro
  premium: LOVABLE_MODELS.image_premium,
};

export function getModelsForPlan(_plan?: string | null, _forcePremium?: boolean): AIModelsConfig {
  return AI_MODELS;
}

export function getCarouselModel(mode: CarouselMode): string {
  return CAROUSEL_MODELS[mode] || CAROUSEL_MODELS.standard;
}

export function getModelDescription(_plan?: string | null, _forcePremium?: boolean): string {
  return 'Vertex AI Gemini 2.5 - Qualité maximum';
}

/**
 * Tous les utilisateurs ont accès Premium
 */
export function hasPremiumAccess(_plan?: string | null, _hasPurchasedPacks?: boolean): boolean {
  return true;
}

/**
 * Retourne le modèle Vertex AI selon le mode carrousel
 */
export function getVertexCarouselModel(mode: CarouselMode): "flash" | "pro" {
  return mode === 'premium' ? 'pro' : 'flash';
}
