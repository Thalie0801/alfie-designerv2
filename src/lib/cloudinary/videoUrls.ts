import { cleanText } from './utils';
import { getCloudName } from './config';

const enc = (t: string) => encodeURIComponent(t);

/**
 * Générer une URL Cloudinary pour vidéo avec overlays texte
 */
export function videoUrl(
  publicId: string,
  o: {
    cloudName: string;
    title?: string;
    subtitle?: string;
    start?: number;
    duration?: number;
    width?: number;
    height?: number;
  }
): string {
  const w = o.width ?? 1080;
  const h = o.height ?? 1920;

  const base = `w_${w},h_${h},c_fill${o.start != null ? `,so_${Math.max(0, o.start)}` : ''}${
    o.duration != null ? `,du_${Math.max(1, o.duration)}` : ''
  },f_mp4`;

  const overlays: string[] = [];
  const t = cleanText(o.title ?? '', 120);
  const s = cleanText(o.subtitle ?? '', 220);

  if (t) {
    overlays.push(
      `l_text:Arial_72_bold:${enc(t)},co_rgb:FFFFFF,g_south,y_280,w_${Math.round(w * 0.9)},c_fit`
    );
  }
  if (s) {
    overlays.push(
      `l_text:Arial_42:${enc(s)},co_rgb:E5E7EB,g_south,y_160,w_${Math.round(w * 0.84)},c_fit`
    );
  }

  const tf = overlays.length ? `/${overlays.join('/')}` : '';
  return `https://res.cloudinary.com/${o.cloudName}/video/upload/${base}${tf}/${publicId}.mp4`;
}

/**
 * Simple video URL sans overlays (backward compat)
 */
export function simpleVideoUrl(
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
    parts.push(`w_${options.width},h_${options.height},c_scale`);
  } else if (options.width) {
    parts.push(`w_${options.width}`);
  } else if (options.height) {
    parts.push(`h_${options.height}`);
  }
  if (options.quality) parts.push(`q_${options.quality}`);
  if (options.format) parts.push(`f_${options.format}`);

  const transform = parts.length ? `/${parts.join(',')}` : '';
  return `https://res.cloudinary.com/${cloudName}/video/upload${transform}/${publicId}.mp4`;
}
