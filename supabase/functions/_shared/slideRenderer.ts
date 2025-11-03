// Phase 3: Renderer SVG pour texte vectoriel sans fautes

import { SlideTemplate, TextLayer } from './slideTemplates.ts';
import { BrandSnapshot } from './brandResolver.ts';

export interface SlideContent {
  title?: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  cta?: string;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
  badge?: string;
  kpis?: Array<{ label: string; delta: string }>;
}

export async function renderSlideToSVG(
  slideContent: SlideContent,
  template: SlideTemplate,
  brandSnapshot: BrandSnapshot
): Promise<string> {
  const { width, height } = template.layout;
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Fond transparent (sera composité avec l'image IA)
  svg += `<rect width="${width}" height="${height}" fill="transparent"/>`;
  
  // Normalize font settings across all layers for consistency
  const baseFontFamily = brandSnapshot.fonts?.default || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const textShadow = '0 2px 4px rgba(0,0,0,0.1)';
  
  // Couche de texte (typo contrôlée, pas d'IA)
  for (const layer of template.textLayers) {
    let text = getTextForLayer(layer, slideContent);
    if (!text) continue;
    
    // Use consistent font from brand kit
    const fontFamily = baseFontFamily;
    let textColor = layer.color;
    
    // ✅ CRITICAL FIX: Valider la couleur et utiliser les couleurs du brand
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(textColor)) {
      console.warn(`[slideRenderer] Invalid color "${textColor}" for layer ${layer.id}, using brand color`);
      textColor = brandSnapshot.primary_color || '#000000';
    }
    
    // Priorité : utiliser les couleurs du brand pour les éléments principaux
    if (layer.id === 'title' && brandSnapshot.primary_color) {
      textColor = brandSnapshot.primary_color;
    } else if (layer.id === 'subtitle' && brandSnapshot.secondary_color) {
      textColor = brandSnapshot.secondary_color;
    }
    
    // Vérifier contraste WCAG AA (4.5:1 minimum)
    const contrastRatio = calculateContrast(textColor, '#FFFFFF');
    if (contrastRatio < 4.5 && layer.type !== 'cta') {
      console.warn(`Low contrast for ${layer.id}: ${contrastRatio.toFixed(2)}`);
      textColor = adjustForContrast(textColor, '#FFFFFF', 4.5);
    }
    
    // Ajouter fond pour CTA
    if (layer.type === 'cta') {
      const ctaBgColor = brandSnapshot.primary_color || '#000000';
      const padding = 20;
      const textWidth = estimateTextWidth(text, layer.size);
      const rectWidth = Math.min(textWidth + padding * 2, layer.maxWidth);
      const rectHeight = layer.size + padding * 2;
      const rectX = layer.align === 'center' 
        ? layer.position.x - rectWidth / 2 
        : layer.position.x;
      const rectY = layer.position.y - layer.size;
      
      svg += `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" 
        fill="${ctaBgColor}" rx="12"/>`;
    }
    
    // Word wrap + multi-lignes
    const lines = wrapText(text, layer.maxWidth, layer.size);
    lines.slice(0, layer.maxLines).forEach((line, i) => {
      const y = layer.position.y + i * (layer.size * 1.2);
      const x = layer.align === 'center' ? layer.position.x : layer.position.x;
      
      svg += `<text x="${x}" y="${y}"
        font-family="${fontFamily}" font-size="${layer.size}" font-weight="${layer.weight}"
        fill="${textColor}" text-anchor="${layer.align === 'center' ? 'middle' : 'start'}">
        ${escapeXml(line)}
      </text>`;
    });
  }
  
  // Bullets si présents
  if (slideContent.bullets && slideContent.bullets.length > 0) {
    const bulletColor = brandSnapshot.primary_color || '#000000';
    slideContent.bullets.forEach((bullet, i) => {
      const y = 450 + i * 120;
      // Cercle bullet
      svg += `<circle cx="80" cy="${y}" r="8" fill="${bulletColor}"/>`;
      // Texte du bullet
      const bulletLines = wrapText(bullet, 880, 28);
      bulletLines.slice(0, 2).forEach((line, lineIndex) => {
        svg += `<text x="110" y="${y + lineIndex * 36 + 8}" 
          font-family="Inter" font-size="28" font-weight="400" fill="#333333">
          ${escapeXml(line)}
        </text>`;
      });
    });
  }
  
  // KPIs si présents (slide impact)
  if (slideContent.kpis && slideContent.kpis.length > 0) {
    slideContent.kpis.forEach((kpi, i) => {
      const y = 500 + i * 160;
      // Label
      svg += `<text x="60" y="${y}" 
        font-family="Inter" font-size="24" font-weight="400" fill="#666666">
        ${escapeXml(kpi.label)}
      </text>`;
      // Delta avec couleur
      const deltaColor = kpi.delta.startsWith('+') || kpi.delta.startsWith('×') 
        ? '#10B981' 
        : '#EF4444';
      svg += `<text x="60" y="${y + 50}" 
        font-family="Inter" font-size="48" font-weight="700" fill="${deltaColor}">
        ${escapeXml(kpi.delta)}
      </text>`;
    });
  }
  
  // Logo avec zone de protection
  if (brandSnapshot.logo_url) {
    const { x, y, width: logoW, height: logoH } = template.logoZone;
    svg += `<image x="${x}" y="${y}" width="${logoW}" height="${logoH}" 
      href="${brandSnapshot.logo_url}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  
  // Close SVG
  svg += '</svg>';

  // Validate SVG structure before returning
  if (!svg.includes('</svg>') || !svg.startsWith('<svg')) {
    console.error('[slideRenderer] Invalid SVG structure detected');
    throw new Error('Generated SVG is malformed');
  }

  // Check for unclosed tags or common issues
  const openTags = (svg.match(/<text[^>]*>/g) || []).length;
  const closeTags = (svg.match(/<\/text>/g) || []).length;
  if (openTags !== closeTags) {
    console.error('[slideRenderer] Unbalanced text tags:', { openTags, closeTags });
    throw new Error('SVG has unbalanced tags');
  }

  return svg;
}

function getTextForLayer(layer: TextLayer, content: SlideContent): string {
  switch (layer.id) {
    case 'title': return content.title || '';
    case 'subtitle': return content.subtitle || '';
    case 'punchline': return content.punchline || '';
    case 'cta': return content.cta || '';
    case 'cta_primary': return content.cta_primary || '';
    case 'cta_secondary': return content.cta_secondary || '';
    case 'note': return content.note || '';
    case 'badge': return content.badge || '';
    default: return '';
  }
}

function calculateContrast(color1: string, color2: string): number {
  const lum1 = relativeLuminance(color1);
  const lum2 = relativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function adjustForContrast(color: string, background: string, targetRatio: number): string {
  let [r, g, b] = hexToRgb(color);
  const bgLum = relativeLuminance(background);
  
  // Si fond clair, assombrir le texte
  if (bgLum > 0.5) {
    while (calculateContrast(`#${toHex(r)}${toHex(g)}${toHex(b)}`, background) < targetRatio) {
      r = Math.max(0, r - 10);
      g = Math.max(0, g - 10);
      b = Math.max(0, b - 10);
      if (r === 0 && g === 0 && b === 0) break;
    }
  } else {
    // Si fond sombre, éclaircir le texte
    while (calculateContrast(`#${toHex(r)}${toHex(g)}${toHex(b)}`, background) < targetRatio) {
      r = Math.min(255, r + 10);
      g = Math.min(255, g + 10);
      b = Math.min(255, b + 10);
      if (r === 255 && g === 255 && b === 255) break;
    }
  }
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.55));
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= charsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Échapper tous les caractères non-ASCII pour Cloudinary
    .replace(/[^\x00-\x7F]/g, (char) => `&#${char.charCodeAt(0)};`);
}
