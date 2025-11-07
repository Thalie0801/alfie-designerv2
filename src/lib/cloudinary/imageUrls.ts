import { Cloudinary } from '@cloudinary/url-gen';
import { scale } from '@cloudinary/url-gen/actions/resize';
import { source } from '@cloudinary/url-gen/actions/overlay';
import { text } from '@cloudinary/url-gen/qualifiers/source';
import { TextStyle } from '@cloudinary/url-gen/qualifiers/textStyle';
import { Position } from '@cloudinary/url-gen/qualifiers/position';
import { compass } from '@cloudinary/url-gen/qualifiers/gravity';
import { max } from '@cloudinary/url-gen/actions/roundCorners';

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dkad5vdyo';

const cld = new Cloudinary({
  cloud: {
    cloudName,
  },
});

export interface SlideUrlOptions {
  title?: string;
  subtitle?: string;
  bulletPoints?: string[];
  cta?: string;
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "9:16", "16:9", "1:1"
}

/**
 * Generate a Cloudinary URL for a carousel slide with text overlays
 * Uses @cloudinary/url-gen SDK for proper transformation handling
 */
export function slideUrl(publicId: string, options: SlideUrlOptions = {}): string {
  // ✅ Validation : rejeter si c'est une URL complète
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    console.error('[slideUrl] ❌ ERREUR : publicId doit être un chemin, pas une URL complète:', publicId);
    // Tenter d'extraire le publicId depuis l'URL
    const match = publicId.match(/\/v\d+\/(.+)\.(jpg|png|webp)/);
    if (match) {
      publicId = match[1];
      console.log('[slideUrl] ✅ Public ID extrait:', publicId);
    } else {
      throw new Error('Invalid publicId: must not be a full URL');
    }
  }

  const {
    title,
    subtitle,
    bulletPoints = [],
    cta,
    width,
    height,
    aspectRatio = '9:16',
  } = options;

  console.log('[slideUrl] Generating URL:', { publicId, title, subtitle, aspectRatio });

  // Start with base image
  let img = cld.image(publicId);

  // Apply aspect ratio or dimensions
  if (width && height) {
    img = img.resize(scale().width(width).height(height));
  } else if (aspectRatio) {
    // Common aspect ratios
    const ratios: Record<string, { w: number; h: number }> = {
      '9:16': { w: 1080, h: 1920 },
      '16:9': { w: 1920, h: 1080 },
      '1:1': { w: 1080, h: 1080 },
      '4:5': { w: 1080, h: 1350 },
    };
    const ratio = ratios[aspectRatio] || ratios['9:16'];
    img = img.resize(scale().width(ratio.w).height(ratio.h));
  }

  // Add rounded corners for modern look
  img = img.roundCorners(max());

  // Add title overlay if provided
  if (title) {
    const titleStyle = new TextStyle('Arial', 72)
      .fontWeight('bold')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(title, titleStyle)
          .textColor('#FFFFFF')
          .backgroundColor('rgba(0,0,0,0.6)')
      ).position(
        new Position().gravity(compass('north')).offsetY(200)
      )
    );
  }

  // Add subtitle overlay if provided
  if (subtitle) {
    const subtitleStyle = new TextStyle('Arial', 48)
      .fontWeight('normal')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(subtitle, subtitleStyle)
          .textColor('#FFFFFF')
          .backgroundColor('rgba(0,0,0,0.5)')
      ).position(
        new Position().gravity(compass('center')).offsetY(0)
      )
    );
  }

  // Add bullet points if provided
  bulletPoints.forEach((bullet, index) => {
    const bulletStyle = new TextStyle('Arial', 40)
      .fontWeight('normal')
      .textAlignment('left');

    const offsetY = -300 + (index * 100);

    img = img.overlay(
      source(
        text(`• ${bullet}`, bulletStyle)
          .textColor('#FFFFFF')
          .backgroundColor('rgba(0,0,0,0.4)')
      ).position(
        new Position().gravity(compass('center')).offsetY(offsetY).offsetX(-400)
      )
    );
  });

  // Add CTA overlay if provided
  if (cta) {
    const ctaStyle = new TextStyle('Arial', 56)
      .fontWeight('bold')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cta, ctaStyle)
          .textColor('#FFFFFF')
          .backgroundColor('rgba(255,100,100,0.9)')
      ).position(
        new Position().gravity(compass('south')).offsetY(200)
      )
    );
  }

  return img.toURL();
}

/**
 * Simple image URL without overlays
 */
export function imageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: string;
  } = {}
): string {
  let img = cld.image(publicId);

  if (options.width && options.height) {
    img = img.resize(
      scale()
        .width(options.width)
        .height(options.height)
    );
  } else if (options.width) {
    img = img.resize(scale().width(options.width));
  } else if (options.height) {
    img = img.resize(scale().height(options.height));
  }

  return img.toURL();
}
