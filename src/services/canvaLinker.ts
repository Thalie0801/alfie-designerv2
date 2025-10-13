import { BrandKit } from '@/hooks/useBrandKit';

export interface CanvaLinkParams {
  templateUrl?: string;
  generatedImageUrl?: string;
  brandKit?: BrandKit;
  customText?: string;
}

export function generateCanvaLink(params: CanvaLinkParams): string {
  const { templateUrl, generatedImageUrl } = params;
  
  // Si on a une image générée par Alfie, on utilise le lien d'import Canva
  if (generatedImageUrl) {
    return `https://www.canva.com/import?design_url=${encodeURIComponent(generatedImageUrl)}`;
  }
  
  // Sinon, on ouvre le template Canva directement
  return templateUrl || '';
}

export function openInCanva(params: CanvaLinkParams) {
  const link = generateCanvaLink(params);
  window.open(link, '_blank');
}
