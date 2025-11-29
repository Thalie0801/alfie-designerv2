import { cleanText } from './utils';

type Aspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5';

const ASPECT_DIM: Record<Aspect, string> = {
  '1:1':  'w_1080,h_1080',
  '16:9': 'w_1920,h_1080',
  '9:16': 'w_1080,h_1920',
  '4:3':  'w_1440,h_1080',
  '3:4':  'w_1080,h_1440',
  '4:5':  'w_1080,h_1350',
};

export function extractCloudNameFromUrl(url?: string | null): string | undefined {
  if (!url) return;
  const m = url.match(/https?:\/\/res\.cloudinary\.com\/([^/]+)/i);
  return m?.[1];
}

function enc(text: string) {
  return encodeURIComponent(text).replace(/%20/g, '%20');
}

/** 1) Une image -> une vidéo courte (Ken Burns + overlays) */
export function imageToVideoUrl(params: {
  cloudName: string;
  imagePublicId: string;
  aspect?: Aspect;
  durationSec?: number;
  zoomPercent?: number;
  pan?: 'center' | 'top' | 'bottom';
  title?: string;
  subtitle?: string;
  cta?: string;
  audioPublicId?: string;
}) {
  const {
    cloudName, imagePublicId,
    aspect = '4:5',
    durationSec = 3,
    zoomPercent = 20,
    pan = 'center',
    title, subtitle, cta,
    audioPublicId
  } = params;

  const dim = ASPECT_DIM[aspect] || ASPECT_DIM['4:5'];

  const kbY =
    pan === 'top' ? ',g_north,y_150' :
    pan === 'bottom' ? ',g_south,y_150' : ',g_center';
  const kenBurns = `e_zoompan:d_${durationSec}:z_${zoomPercent}${kbY}`;

  const overlays: string[] = [];
  if (title) {
    overlays.push(`l_text:Arial_70_bold:${enc(cleanText(title, 80))},co_rgb:FFFFFF,g_north,y_200`);
  }
  if (subtitle) {
    overlays.push(`l_text:Arial_44:${enc(cleanText(subtitle, 100))},co_rgb:E5E7EB,g_center,y_50`);
  }
  if (cta) {
    overlays.push(`l_text:Arial_56_bold:${enc(cleanText(cta, 50))},co_rgb:FFFFFF,g_south,y_160`);
  }

  const audio = audioPublicId ? `/l_audio:${enc(audioPublicId)}` : '';

  return [
    `https://res.cloudinary.com/${cloudName}/video/upload`,
    `/${dim},c_fill,f_mp4,${kenBurns}`,
    overlays.length ? `/${overlays.join('/')}` : '',
    audio,
    `/${imagePublicId}.mp4`
  ].join('');
}

/** 2) Concaténer plusieurs images/vidéos -> 1 vidéo (fl_splice) */
export function spliceVideoUrl(params: {
  cloudName: string;
  items: Array<
    | { type: 'image'; publicId: string; durationSec?: number }
    | { type: 'video'; publicId: string; trimStartSec?: number; trimEndSec?: number }
  >;
  aspect?: Aspect;
  title?: string;
  subtitle?: string;
  cta?: string;
  audioPublicId?: string;
}) {
  const {
    cloudName, items,
    aspect = '4:5',
    title, subtitle, cta,
    audioPublicId
  } = params;

  const dim = ASPECT_DIM[aspect] || ASPECT_DIM['4:5'];

  const parts: string[] = [`https://res.cloudinary.com/${cloudName}/video/upload/${dim},c_fill,f_mp4`];

  const globalOverlays: string[] = [];
  if (title)    globalOverlays.push(`l_text:Arial_70_bold:${enc(cleanText(title, 80))},co_rgb:FFFFFF,g_north,y_200`);
  if (subtitle) globalOverlays.push(`l_text:Arial_44:${enc(cleanText(subtitle, 100))},co_rgb:E5E7EB,g_center,y_50`);
  if (cta)      globalOverlays.push(`l_text:Arial_56_bold:${enc(cleanText(cta, 50))},co_rgb:FFFFFF,g_south,y_160`);
  if (globalOverlays.length) parts.push('/' + globalOverlays.join('/'));

  items.forEach((it) => {
    if (it.type === 'image') {
      const du = Math.max(1, it.durationSec ?? 2);
      parts.push(`/l_image:${enc(it.publicId)},du_${du},fl_splice`);
    } else {
      const trims: string[] = [];
      if (typeof it.trimStartSec === 'number') trims.push(`so_${Math.max(0, it.trimStartSec)}`);
      if (typeof it.trimEndSec === 'number')   trims.push(`eo_${Math.max(0, it.trimEndSec)}`);
      const trimSeg = trims.length ? `,${trims.join(',')}` : '';
      parts.push(`/l_video:${enc(it.publicId)}${trimSeg},fl_splice`);
    }
  });

  if (audioPublicId) {
    parts.push(`/l_audio:${enc(audioPublicId)}`);
  }

  return parts.join('');
}

/** 3) Poster (thumbnail) depuis une vidéo Cloudinary */
export function posterFromVideoUrl(videoUrl: string, second = 1) {
  return videoUrl.replace('/video/upload/', `/video/upload/so_${second}/`).replace(/\.mp4(\?.*)?$/, '.jpg');
}
