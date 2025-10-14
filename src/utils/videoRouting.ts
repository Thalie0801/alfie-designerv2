// Routing vidéo intelligent (Sora vs Veo 3)
// Règles: Sora = 1 Woof, Veo 3 = 4 Woofs
import { SYSTEM_CONFIG } from '@/config/systemConfig';

export const VEO3_WOOF_FACTOR = SYSTEM_CONFIG.VEO3_WOOF_FACTOR;
export const SORA_WOOF_FACTOR = SYSTEM_CONFIG.SORA_WOOF_FACTOR;

export type VideoEngine = 'sora' | 'veo3';

export interface VideoRoutingDecision {
  engine: VideoEngine;
  woofCost: number;
  reason: string;
}

export interface VideoRequest {
  seconds: number;
  style?: string;
  remainingWoofs?: number;
}

/**
 * Détermine quel moteur vidéo utiliser selon les règles produit
 * 
 * Règles actuelles:
 * - Sora2 uniquement pour l'instant (via Kie AI)
 * - Veo 3 sera activé quand FEATURE_FLAGS.VEO3_ENABLED=true
 */
export function routeVideoEngine(request: VideoRequest): VideoRoutingDecision {
  // Sora 2 via Kie AI (disponible depuis décembre 2024)
  // TODO: Activer Veo 3 quand FEATURE_FLAGS.VEO3_ENABLED=true
  return {
    engine: 'sora',
    woofCost: SORA_WOOF_FACTOR,
    reason: 'Sora 2 via Kie AI (disponible depuis décembre 2024)'
  };
}

/**
 * Estime la durée d'une vidéo depuis un prompt
 * Retourne une estimation en secondes
 */
export function estimateVideoDuration(prompt: string): number {
  const promptLower = prompt.toLowerCase();
  
  // Détection explicite de durée
  const durationMatch = prompt.match(/(\d+)\s*(s|sec|second|secondes)/i);
  if (durationMatch) {
    return parseInt(durationMatch[1], 10);
  }

  // Mots-clés qui indiquent une durée
  if (/court|rapide|quick|intro|teaser/.test(promptLower)) return 5;
  if (/long|détaillé|complet|full/.test(promptLower)) return 15;
  if (/story|reel|tiktok/.test(promptLower)) return 8;
  
  // Default: 8 secondes (bon compromis)
  return 8;
}

/**
 * Détecte le style vidéo depuis un prompt
 */
export function detectVideoStyle(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  if (/cinéma|cinematic|film|movie/.test(promptLower)) return 'cinématique';
  if (/pub|ads|commercial|promo/.test(promptLower)) return 'ads';
  if (/reel|story|tiktok/.test(promptLower)) return 'reel';
  if (/loop|répét|boucle/.test(promptLower)) return 'loop';
  if (/intro|opening/.test(promptLower)) return 'intro';
  
  return 'standard';
}