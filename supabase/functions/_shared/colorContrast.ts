// Détection automatique du contraste texte/background

/**
 * Calcule la luminosité relative d'une couleur hexadécimale
 * Formule: L = 0.299*R + 0.587*G + 0.114*B
 */
export function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const rgb = parseInt(clean, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Détermine la meilleure couleur de texte (noir ou blanc) selon le fond
 * @param backgroundColors - Palette de couleurs de la marque (priorité à la première)
 * @returns Couleur hexadécimale sans '#' (ex: 'ffffff' ou '000000')
 */
export function getContrastingColor(backgroundColors: string[]): string {
  if (!backgroundColors || backgroundColors.length === 0) {
    return 'ffffff'; // Blanc par défaut
  }

  // Utiliser la couleur primaire comme référence
  const primaryColor = backgroundColors[0].replace('#', '');
  const luminance = getLuminance(primaryColor);

  // Si la couleur de fond est claire (luminance > 128), utiliser du noir
  // Sinon, utiliser du blanc
  return luminance > 128 ? '000000' : 'ffffff';
}

/**
 * Version avancée avec outline automatique pour garantir la lisibilité
 * @param backgroundColors - Palette de couleurs de la marque
 * @returns Objet { color, outline } avec la couleur du texte et de l'outline
 */
export function getContrastingTextStyle(backgroundColors: string[]): {
  color: string;
  outline: string;
  outlineWidth: number;
} {
  const textColor = getContrastingColor(backgroundColors);
  
  // Outline inversé pour maximum de contraste
  const outlineColor = textColor === 'ffffff' ? '000000' : 'ffffff';
  
  return {
    color: textColor,
    outline: outlineColor,
    outlineWidth: 12 // Outline épais pour garantir la lisibilité
  };
}
