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

/**
 * Convertit un code hex en description de couleur naturelle
 * pour éviter que le modèle n'affiche "#90E3C2" dans l'image
 */
export function hexToColorName(hex: string): string {
  if (!hex) return 'neutral';
  const h = hex.toLowerCase().replace('#', '');
  
  // Parse RGB
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  
  // Calculer luminosité et teinte
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (max + min) / 2 / 255;
  
  // Couleurs extrêmes
  if (lum < 0.15) return 'deep black';
  if (lum > 0.95) return 'pure white';
  if (lum > 0.85) return 'very light, almost white';
  
  // Calculer la teinte (hue)
  let hue = 0;
  const delta = max - min;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / delta + 2) * 60;
    else hue = ((r - g) / delta + 4) * 60;
  }
  
  // Saturation
  const sat = delta / Math.max(1, 255 - Math.abs(2 * lum * 255 - 255));
  if (sat < 0.1) {
    // Gris/neutre
    if (lum < 0.4) return 'dark gray';
    if (lum < 0.6) return 'medium gray';
    return 'light gray';
  }
  
  // Luminosité qualifier
  const lumQual = lum < 0.35 ? 'dark ' : lum > 0.7 ? 'light ' : lum > 0.55 ? 'soft ' : '';
  const satQual = sat > 0.7 ? 'vibrant ' : sat < 0.4 ? 'muted ' : '';
  
  // Teinte principale
  let colorName = '';
  if (hue < 15 || hue >= 345) colorName = 'red';
  else if (hue < 45) colorName = 'orange';
  else if (hue < 70) colorName = 'yellow';
  else if (hue < 150) colorName = 'green';
  else if (hue < 195) colorName = 'cyan';
  else if (hue < 255) colorName = 'blue';
  else if (hue < 285) colorName = 'purple';
  else if (hue < 345) colorName = 'pink';
  
  // Variantes spécifiques
  if (colorName === 'green' && lum > 0.6) colorName = 'mint green';
  if (colorName === 'pink' && lum > 0.7) colorName = 'blush pink';
  if (colorName === 'purple' && lum > 0.6) colorName = 'lavender';
  if (colorName === 'orange' && lum > 0.7) colorName = 'peach';
  if (colorName === 'blue' && sat < 0.4 && lum > 0.7) colorName = 'soft blue';
  
  return `${satQual}${lumQual}${colorName}`.trim();
}

/**
 * Convertit une palette de codes hex en descriptions naturelles
 * @param palette - Tableau de codes hex
 * @returns Description textuelle des couleurs
 */
export function paletteToDescriptions(palette?: string[]): string {
  if (!palette?.length) return 'professional neutral tones';
  return palette
    .slice(0, 5)
    .map(hex => hexToColorName(hex))
    .filter(Boolean)
    .join(', ');
}
