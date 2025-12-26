import { BrandKit } from '@/hooks/useBrandKit';

export interface CanvaLinkParams {
  templateUrl?: string;
  generatedImageUrl?: string;
  generatedImageUrls?: string[];
  brandKit?: BrandKit;
  customText?: string;
}

/**
 * Génère un lien d'import Canva pour une image publique.
 * Fonctionne sans API - l'utilisateur se connecte à son propre compte Canva.
 * @see https://www.canva.com/import?design_url=...
 */
export function generateCanvaImportUrl(imageUrl: string): string {
  return `https://www.canva.com/import?design_url=${encodeURIComponent(imageUrl)}`;
}

export function generateCanvaLink(params: CanvaLinkParams): string {
  const { templateUrl, generatedImageUrl, generatedImageUrls } = params;
  
  // Priorité : image générée unique, puis première du tableau
  const imageToImport = generatedImageUrl || generatedImageUrls?.[0];
  
  if (imageToImport) {
    return generateCanvaImportUrl(imageToImport);
  }
  
  // Fallback : template Canva
  return templateUrl || '';
}

export function openInCanva(params: CanvaLinkParams) {
  const link = generateCanvaLink(params);
  if (link) {
    window.open(link, '_blank');
  }
}

/**
 * Ouvre directement une image dans Canva via le lien d'import public.
 */
export function openImageInCanva(imageUrl: string) {
  const link = generateCanvaImportUrl(imageUrl);
  window.open(link, '_blank');
}
