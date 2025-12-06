import { cleanText } from './utils';
import { getCloudName } from './config';

export type SlideUrlOptions = {
  cloudName: string;
  title?: string;
  subtitle?: string;
  body?: string;
  bulletPoints?: string[];
  cta?: string;
  aspectRatio?: '4:5' | '1:1' | '9:16' | '16:9';
};

function dims(ar: SlideUrlOptions['aspectRatio']) {
  if (ar === '9:16') return { w: 1080, h: 1920 };
  if (ar === '16:9') return { w: 1920, h: 1080 };
  if (ar === '1:1') return { w: 1080, h: 1080 };
  return { w: 1080, h: 1350 }; // 4:5
}

/**
 * Encode text for Cloudinary overlay - double-encode special delimiters
 * Cloudinary uses , and / as delimiters in transformation URLs
 */
const enc = (t: string) => {
  // First pass: standard URL encoding
  let encoded = encodeURIComponent(t);
  
  // Double-encode Cloudinary delimiters:
  // - %2C (comma) → %252C (Cloudinary interprets %2C as delimiter)
  // - %2F (slash) → %252F (same issue)
  encoded = encoded
    .replace(/%2C/g, '%252C')  // Double-encode comma
    .replace(/%2F/g, '%252F'); // Double-encode slash
  
  return encoded;
};

/**
 * Générer une URL Cloudinary avec overlays texte
 * Construction manuelle pour garantir la robustesse
 */
export function slideUrl(publicId: string, o: SlideUrlOptions): string {
  // Extraire publicId si URL complète fournie
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    const match = publicId.match(/\/v\d+\/(.+)\.(jpg|png|webp)/);
    if (match) publicId = match[1];
    else throw new Error('Invalid publicId: must be path, not full URL');
  }

  const { w, h } = dims(o.aspectRatio);
  const base = `w_${w},h_${h},c_fill,f_png`;
  const overlays: string[] = [];

  const title = cleanText(o.title ?? '', 120);
  const sub = cleanText(o.subtitle ?? '', 220);
  const bodyText = cleanText(o.body ?? '', 300);
  const bullets = (o.bulletPoints ?? []).map((b) => cleanText(b, 80)).slice(0, 6);
  const cta = cleanText(o.cta ?? '', 60);

  // Configuration responsive selon format
  const config = o.aspectRatio === '9:16' 
    ? { titleSize: 80, subSize: 52, bulletSize: 36, bodySize: 40 }
    : o.aspectRatio === '16:9'
    ? { titleSize: 64, subSize: 38, bulletSize: 32, bodySize: 36 }
    : o.aspectRatio === '1:1'
    ? { titleSize: 72, subSize: 42, bulletSize: 36, bodySize: 40 }
    : { titleSize: 72, subSize: 42, bulletSize: 36, bodySize: 40 }; // 4:5

  // Déterminer le mode de layout selon le contenu disponible
  const hasOnlyTitle = title && !sub && !bodyText && bullets.length === 0 && !cta;
  const hasTitleAndBody = title && bodyText && !sub && bullets.length === 0 && !cta;

  if (hasOnlyTitle) {
    // MODE 1 : Titre seul → CENTRÉ verticalement avec CONTRASTE
    overlays.push(
      `l_text:Arial_${config.titleSize}_bold:${enc(title)},co_rgb:FFFFFF,e_stroke:8:co_rgb:000000,e_shadow:50,g_center,y_0,w_${Math.round(w * 0.9)},c_fit`
    );
  } else if (hasTitleAndBody) {
    // MODE 2 : Titre + Corps → CENTRÉS avec CONTRASTE
    const titleY = -60;
    const bodyY = titleY + config.titleSize + 30;
    
    overlays.push(
      `l_text:Arial_${config.titleSize}_bold:${enc(title)},co_rgb:FFFFFF,e_stroke:8:co_rgb:000000,e_shadow:50,g_center,y_${titleY},w_${Math.round(w * 0.9)},c_fit`
    );
    overlays.push(
      `l_text:Arial_${config.bodySize}:${enc(bodyText)},co_rgb:FFFFFF,e_stroke:4:co_rgb:000000,e_shadow:40,g_center,y_${bodyY},w_${Math.round(w * 0.82)},c_fit`
    );
  } else {
    // MODE 3 : Layout complet - CENTRÉ avec CONTRASTE
    const fullConfig = o.aspectRatio === '9:16' 
      ? { titleY: -120, subOffset: 80, bulletStart: 60, bulletStep: 60 }
      : o.aspectRatio === '16:9'
      ? { titleY: -80, subOffset: 60, bulletStart: 40, bulletStep: 50 }
      : o.aspectRatio === '1:1'
      ? { titleY: -100, subOffset: 70, bulletStart: 50, bulletStep: 55 }
      : { titleY: -100, subOffset: 70, bulletStart: 50, bulletStep: 55 }; // 4:5

    // TITRE (CENTRÉ)
    if (title) {
      overlays.push(
        `l_text:Arial_${config.titleSize}_bold:${enc(title)},co_rgb:FFFFFF,e_stroke:8:co_rgb:000000,e_shadow:50,g_center,y_${fullConfig.titleY},w_${Math.round(w * 0.9)},c_fit`
      );
    }

    // SOUS-TITRE (CENTRÉ sous le titre)
    if (sub) {
      const subY = fullConfig.titleY + fullConfig.subOffset + (title ? 40 : 0);
      overlays.push(
        `l_text:Arial_${config.subSize}:${enc(sub)},co_rgb:FFFFFF,e_stroke:5:co_rgb:000000,e_shadow:40,g_center,y_${subY},w_${Math.round(w * 0.84)},c_fit`
      );
    }

    // BODY (CENTRÉ)
    if (bodyText) {
      const bodyY = fullConfig.bulletStart;
      overlays.push(
        `l_text:Arial_${config.bodySize}:${enc(bodyText)},co_rgb:FFFFFF,e_stroke:4:co_rgb:000000,e_shadow:40,g_center,y_${bodyY},w_${Math.round(w * 0.82)},c_fit`
      );
    }

    // BULLETS (CENTRÉS)
    bullets.forEach((b, i) => {
      const bulletY = fullConfig.bulletStart + (bodyText ? 80 : 0) + i * fullConfig.bulletStep;
      overlays.push(
        `l_text:Arial_${config.bulletSize}:${enc('- ' + b)},co_rgb:FFFFFF,e_stroke:4:co_rgb:000000,e_shadow:40,g_center,y_${bulletY},w_${Math.round(w * 0.8)},c_fit`
      );
    });

    // CTA (en bas centré)
    if (cta) {
      const ctaSize = o.aspectRatio === '16:9' ? 44 : 48;
      overlays.push(`l_text:Arial_${ctaSize}_bold:${enc(cta)},co_rgb:FFFFFF,e_stroke:6:co_rgb:000000,e_shadow:50,g_center,y_250`);
    }
  }

  const tf = overlays.length ? `/${overlays.join('/')}` : '';
  return `https://res.cloudinary.com/${o.cloudName}/image/upload/${base}${tf}/${publicId}`;
}

/**
 * Générer une URL Cloudinary basique (sans overlay texte)
 */
export function imageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: string;
    cloudName?: string;
  } = {}
): string {
  const cloudName = options.cloudName || getCloudName();

  const parts: string[] = [];
  if (options.width && options.height) {
    parts.push(`w_${options.width},h_${options.height},c_fill`);
  } else if (options.width) {
    parts.push(`w_${options.width}`);
  } else if (options.height) {
    parts.push(`h_${options.height}`);
  }
  if (options.quality) parts.push(`q_${options.quality}`);
  if (options.format) parts.push(`f_${options.format}`);

  const transform = parts.length ? `/${parts.join(',')}` : '';
  return `https://res.cloudinary.com/${cloudName}/image/upload${transform}/${publicId}`;
}
