import { cleanText } from './utils';
import { encodeOverlayText } from './text';

export type SlideUrlOptions = {
  cloudName: string;
  title?: string;
  subtitle?: string;
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
  const bullets = (o.bulletPoints ?? []).map((b) => cleanText(b, 80)).slice(0, 6);
  const cta = cleanText(o.cta ?? '', 60);

  // Texte adapté au format (tailles + offsets)
  if (title) {
    const size = o.aspectRatio === '9:16' ? 80 : o.aspectRatio === '16:9' ? 64 : 72;
    const y = o.aspectRatio === '9:16' ? 140 : 120;
    overlays.push(
      `l_text:Arial_${size}_bold:${encodeOverlayText(title)},co_rgb:FFFFFF,g_north,y_${y},w_${Math.round(
        w * 0.9
      )},c_fit`
    );
  }

  if (sub) {
    const size = o.aspectRatio === '9:16' ? 52 : o.aspectRatio === '16:9' ? 38 : 42;
    const y = o.aspectRatio === '9:16' ? 220 : 140;
    overlays.push(
      `l_text:Arial_${size}:${encodeOverlayText(sub)},co_rgb:E5E7EB,g_south,y_${y},w_${Math.round(
        w * 0.84
      )},c_fit`
    );
  }

  bullets.forEach((b, i) => {
    const size = o.aspectRatio === '16:9' ? 32 : 36;
    const startY = o.aspectRatio === '9:16' ? 380 : 300;
    overlays.push(
      `l_text:Arial_${size}:${encodeOverlayText('• ' + b)},co_rgb:FFFFFF,g_center,y_${
        startY + i * 60
      },w_${Math.round(w * 0.8)},c_fit`
    );
  });

  if (cta) {
    const size = o.aspectRatio === '16:9' ? 44 : 48;
    overlays.push(`l_text:Arial_${size}_bold:${encodeOverlayText(cta)},co_rgb:FFFFFF,g_south,y_80`);
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
  const cloudName =
    options.cloudName || (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);
  if (!cloudName) throw new Error('cloudName missing');

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
