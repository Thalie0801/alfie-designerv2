import { Cloudinary } from '@cloudinary/url-gen';
import { fill, scale } from '@cloudinary/url-gen/actions/resize';
import { source } from '@cloudinary/url-gen/actions/overlay';
import { text } from '@cloudinary/url-gen/qualifiers/source';
import { TextStyle } from '@cloudinary/url-gen/qualifiers/textStyle';
import { Position } from '@cloudinary/url-gen/qualifiers/position';
import { compass } from '@cloudinary/url-gen/qualifiers/gravity';
import { max } from '@cloudinary/url-gen/actions/roundCorners';
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

  // Add rounded corners for modern look
  img = img.roundCorners(max());

  // Add title overlay if provided
  if (cleanTitle) {
    const titleStyle = new TextStyle('Arial', 72)
      .fontWeight('bold')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cleanTitle, titleStyle)
          .textColor('#FFFFFF')
      ).position(
        new Position().gravity(compass('north')).offsetY(200)
      )
    );
  }

  // Add subtitle overlay if provided
  if (cleanSubtitle) {
    const subtitleStyle = new TextStyle('Arial', 48)
      .fontWeight('normal')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cleanSubtitle, subtitleStyle)
          .textColor('#E5E7EB')
      ).position(
        new Position().gravity(compass('center')).offsetY(0)
      )
    );
  }

  // Add bullet points if provided
  cleanBullets.forEach((bullet, index) => {
    if (!bullet) return;
    
    const bulletStyle = new TextStyle('Arial', 40)
      .fontWeight('normal')
      .textAlignment('left');

    const offsetY = -300 + (index * 100);

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
    const ctaStyle = new TextStyle('Arial', 56)
      .fontWeight('bold')
      .textAlignment('center');

    img = img.overlay(
      source(
        text(cleanCta, ctaStyle)
          .textColor('#FFFFFF')
      ).position(
        new Position().gravity(compass('south')).offsetY(200)
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
