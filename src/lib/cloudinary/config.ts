/**
 * Configuration Cloudinary centralisée pour Alfie Designer
 * Ce fichier est la SOURCE DE VÉRITÉ pour le cloud name.
 */

// Cloud name de production Alfie Designer
export const CLOUDINARY_CLOUD_NAME = 'dcuvvilto';

/**
 * Récupère le cloud name de manière robuste :
 * 1. Essaie d'extraire depuis une URL fournie (priorité absolue)
 * 2. Utilise VITE_CLOUDINARY_CLOUD_NAME si définie (dev local)
 * 3. Fallback vers le cloud name hardcodé de production
 */
export function getCloudName(urlHint?: string | null): string {
  // 1) Extraction depuis URL (priorité : respecte les URLs existantes)
  if (urlHint) {
    const match = urlHint.match(/res\.cloudinary\.com\/([^/]+)/i);
    if (match?.[1]) return match[1];
  }

  // 2) Variable d'environnement (utile en dev)
  const envVar = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  if (envVar) return envVar;

  // 3) Fallback ultime vers la production (avec log pour debug)
  console.warn('[Cloudinary] Falling back to default cloud name "dcuvvilto"');
  return CLOUDINARY_CLOUD_NAME;
}
