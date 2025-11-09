import { cleanText } from './utils';
import { encodeOverlayText } from './text';

/**
 * Générer un reel animé depuis une image statique
 * Utilise un template Cloudinary (clip de base) + image en background
 */
export function reelFromImageUrl(
  baseClipPublicId: string,
  bgImagePublicId: string,
  o: {
    cloudName: string;
    title?: string;
    subtitle?: string;
    duration?: number;
  }
): string {
  const dur = Math.max(1, o.duration ?? 6);
  const overlays = [
    `l_${bgImagePublicId},c_fill,w_1080,h_1920,g_center`, // Image de fond
  ];

  const t = cleanText(o.title ?? '', 120);
  const s = cleanText(o.subtitle ?? '', 220);

  if (t) {
    overlays.push(`l_text:Arial_72_bold:${encodeOverlayText(t)},co_rgb:FFFFFF,g_south,y_280,w_980,c_fit`);
  }
  if (s) {
    overlays.push(`l_text:Arial_42:${encodeOverlayText(s)},co_rgb:E5E7EB,g_south,y_160,w_900,c_fit`);
  }

  const tf = `du_${dur},f_mp4/${overlays.join('/')}`;
  return `https://res.cloudinary.com/${o.cloudName}/video/upload/${tf}/${baseClipPublicId}.mp4`;
}
