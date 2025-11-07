import { Cloudinary } from '@cloudinary/url-gen';
import { fill, scale } from '@cloudinary/url-gen/actions/resize';
import { source } from '@cloudinary/url-gen/actions/overlay';
import { text } from '@cloudinary/url-gen/qualifiers/source';
import { TextStyle } from '@cloudinary/url-gen/qualifiers/textStyle';
import { Position } from '@cloudinary/url-gen/qualifiers/position';
import { compass } from '@cloudinary/url-gen/qualifiers/gravity';
import { byRadius } from '@cloudinary/url-gen/actions/roundCorners';
import { extractCloudNameFromUrl, cleanText } from './utils';

export interface SlideUrlOptions {
  title?: string;
  subtitle?: string;
  bulletPoints?: string[];
  cta?: string;
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "9:16", "16:9", "1:1"
  cloudName: string; // REQUIRED - must be extracted by caller
  baseUrlForCloudGuess?: string; // URL to extract cloudName from if not provided
}

/**
 * Retourne les tailles et positions de texte adaptées au format
 */
function getTextSizes(aspectRatio: string) {
  switch (aspectRatio) {
    case '9:16': // Portrait Stories/Reels
      return {
        title: { size: 80, offsetY: 300 },
        subtitle: { size: 52, offsetY: 50 },
        bullet: { size: 44, offsetY: -350, spacing: 110 },
        cta: { size: 60, offsetY: 250 }
      };
    case '16:9': // Paysage YouTube
      return {
        title: { size: 64, offsetY: 150 },
        subtitle: { size: 42, offsetY: 0 },
        bullet: { size: 36, offsetY: -250, spacing: 90 },
        cta: { size: 50, offsetY: 180 }
      };
    case '1:1': // Carré Instagram
      return {
        title: { size: 70, offsetY: 180 },
        subtitle: { size: 46, offsetY: 0 },
        bullet: { size: 38, offsetY: -280, spacing: 95 },
        cta: { size: 54, offsetY: 200 }
      };
    case '4:5': // Portrait classique
    default:
      return {
        title: { size: 72, offsetY: 200 },
        subtitle: { size: 48, offsetY: 0 },
        bullet: { size: 40, offsetY: -300, spacing: 100 },
        cta: { size: 56, offsetY: 200 }
      };
  }
}

/**
 * Generate a Cloudinary URL for a carousel slide with text overlays
 * Uses @cloudinary/url-gen SDK for proper transformation handling
 */
export function slideUrl(publicId: string, options: SlideUrlOptions = { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dkad5vdyo' }): string {
  // ✅ Validation : rejeter si c'est une URL complète
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    // Tenter d'extraire le publicId depuis l'URL
    const match = publicId.match(/\/v\d+\/(.+)\.(jpg|png|webp)/);
    if (match) {
      publicId = match[1];
    } else {
      throw new Error('Invalid publicId: must not be a full URL');
    }
  }

  // Determine cloudName: explicit > env > extracted from URL
  const envCloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const guessed = extractCloudNameFromUrl(options.baseUrlForCloudGuess);
  const cloudName = options.cloudName || envCloud || guessed;
  
  if (!cloudName) {
    throw new Error('cloudName introuvable pour Cloudinary. Passez cloudName ou baseUrlForCloudGuess.');
  }

  // Create Cloudinary instance with determined cloudName
  const cld = new Cloudinary({ cloud: { cloudName } });

  const {
    title,
    subtitle,
    bulletPoints = [],
    cta,
    width,
    height,
    aspectRatio = '9:16',
  } = options;

  // Clean texts to remove emojis, control characters, and clamp length
  const cleanTitle = cleanText(title, 120);
  const cleanSubtitle = cleanText(subtitle, 220);
  const cleanBullets = bulletPoints.map(b => cleanText(b, 80)).slice(0, 6);
  const cleanCta = cleanText(cta, 60);

  // Get text sizes adapted to format
  const sizes = getTextSizes(aspectRatio);

  // Start with base image
  let img = cld.image(publicId);

  // Apply aspect ratio or dimensions using fill for better cropping
  if (width && height) {
    img = img.resize(fill().width(width).height(height));
  } else if (aspectRatio) {
    // Common aspect ratios
    const ratios: Record<string, { w: number; h: number }> = {
      '9:16': { w: 1080, h: 1920 },
      '16:9': { w: 1920, h: 1080 },
      '1:1': { w: 1080, h: 1080 },
      '4:5': { w: 1080, h: 1350 },
    };
    const ratio = ratios[aspectRatio] || ratios['9:16'];
    img = img.resize(fill().width(ratio.w).height(ratio.h));
  }

  // Add subtle rounded corners for modern look (20px radius instead of max to avoid oval effect)
  img = img.roundCorners(byRadius(20));

  // Add title overlay if provided
  if (cleanTitle) {
    const titleStyle = new TextStyle('Arial', sizes.title.size)
      .fontWeight('bold')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cleanTitle, titleStyle)
          .textColor('#FFFFFF')
      ).position(
        new Position().gravity(compass('north')).offsetY(sizes.title.offsetY)
      )
    );
  }

  // Add subtitle overlay if provided
  if (cleanSubtitle) {
    const subtitleStyle = new TextStyle('Arial', sizes.subtitle.size)
      .fontWeight('normal')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cleanSubtitle, subtitleStyle)
          .textColor('#E5E7EB')
      ).position(
        new Position().gravity(compass('center')).offsetY(sizes.subtitle.offsetY)
      )
    );
  }

  // Add bullet points if provided
  cleanBullets.forEach((bullet, index) => {
    if (!bullet) return;
    
    const bulletStyle = new TextStyle('Arial', sizes.bullet.size)
      .fontWeight('normal')
      .textAlignment('left');

    const offsetY = sizes.bullet.offsetY + (index * sizes.bullet.spacing);

    img = img.overlay(
      source(
        text(`• ${bullet}`, bulletStyle)
          .textColor('#FFFFFF')
      ).position(
        new Position().gravity(compass('center')).offsetY(offsetY).offsetX(-400)
      )
    );
  });

  // Add CTA overlay if provided
  if (cleanCta) {
    const ctaStyle = new TextStyle('Arial', sizes.cta.size)
      .fontWeight('bold')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cleanCta, ctaStyle)
          .textColor('#FFFFFF')
      ).position(
        new Position().gravity(compass('south')).offsetY(sizes.cta.offsetY)
      )
    );
  }

  // Force PNG format for stable rendering
  img = img.format('png');

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
    cloudName?: string;
  } = {}
): string {
  const envCloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const cloudName = options.cloudName || envCloud || 'dkad5vdyo';
  
  const cld = new Cloudinary({ cloud: { cloudName } });
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
