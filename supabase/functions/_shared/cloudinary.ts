// Centralized Cloudinary SDK module
import { Cloudinary } from "npm:@cloudinary/url-gen@^1.20.0";
import { text } from "npm:@cloudinary/url-gen@^1.20.0/qualifiers/source";
import { Position } from "npm:@cloudinary/url-gen@^1.20.0/qualifiers/position";
import { compass } from "npm:@cloudinary/url-gen@^1.20.0/qualifiers/gravity";
import { TextStyle } from "npm:@cloudinary/url-gen@^1.20.0/qualifiers/textStyle";
import { format, quality } from "npm:@cloudinary/url-gen@^1.20.0/actions/delivery";

// Initialize Cloudinary SDK
export function getCloudinaryInstance(): Cloudinary {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME not configured');
  
  return new Cloudinary({
    cloud: { cloudName }
  });
}

export interface CarouselSlideOptions {
  publicId: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  cta?: string;
  colors: {
    title: string;
    subtitle: string;
  };
  fonts: {
    title: string;
    subtitle: string;
  };
}

/**
 * Build carousel slide image URL with text overlays
 * Uses manual transformation string for full control (outline not supported in SDK)
 */
export function buildCarouselSlideUrl(options: CarouselSlideOptions): string {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME not configured');
  
  const transformations: string[] = [];
  
  // Helper to encode text safely
  const encodeText = (text: string): string => {
    return encodeURIComponent(text)
      .replace(/%2C/g, '%252C')
      .replace(/%2F/g, '%252F')
      .replace(/%3A/g, '%253A');
  };
  
  // Title overlay
  if (options.title) {
    const titleText = options.title.length > 100 ? options.title.substring(0, 97) + '...' : options.title;
    const encoded = encodeText(titleText);
    const font = options.fonts.title.replace(/\s+/g, '%20');
    transformations.push(
      `l_text:${font}_72_bold:${encoded},co_rgb:${options.colors.title},e_outline:14:color_000000,w_960,c_fit,g_north,y_80/fl_layer_apply`
    );
  }

  // Subtitle overlay
  if (options.subtitle) {
    const subtitleText = options.subtitle.length > 150 ? options.subtitle.substring(0, 147) + '...' : options.subtitle;
    const encoded = encodeText(subtitleText);
    const font = options.fonts.subtitle.replace(/\s+/g, '%20');
    transformations.push(
      `l_text:${font}_42:${encoded},co_rgb:${options.colors.subtitle},e_outline:10:color_000000,w_960,c_fit,g_north,y_180/fl_layer_apply`
    );
  }

  // Bullets (max 5)
  if (options.bullets && options.bullets.length > 0) {
    const font = options.fonts.subtitle.replace(/\s+/g, '%20');
    options.bullets.slice(0, 5).forEach((bullet, i) => {
      const bulletText = bullet.length > 80 ? bullet.substring(0, 77) + '...' : bullet;
      const encoded = encodeText(`• ${bulletText}`);
      const yPos = 100 + ((4 - i) * 60); // Stack from bottom up
      transformations.push(
        `l_text:${font}_42:${encoded},co_rgb:${options.colors.subtitle},e_outline:10:color_000000,w_900,c_fit,g_south_west,x_80,y_${yPos}/fl_layer_apply`
      );
    });
  }

  // CTA overlay
  if (options.cta) {
    const ctaText = options.cta.length > 50 ? options.cta.substring(0, 47) + '...' : options.cta;
    const encoded = encodeText(ctaText);
    const font = options.fonts.title.replace(/\s+/g, '%20');
    transformations.push(
      `l_text:${font}_44_bold:${encoded},co_rgb:${options.colors.title},e_outline:12:color_000000,w_700,c_fit,g_south,y_80/fl_layer_apply`
    );
  }

  // Final format
  transformations.push('f_png,q_auto,cs_srgb');
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations.join('/')}/${options.publicId}`;
}

/**
 * Upload image to Cloudinary using Node SDK (for server-side operations)
 * This will be used when we need to upload with signatures
 */
export async function uploadToCloudinary(
  imageData: string,
  options: {
    folder: string;
    publicId?: string;
    tags?: string[];
    context?: Record<string, string>;
  }
): Promise<{
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
}> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  // For Deno, we'll use the REST API approach with proper signing
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string> = { timestamp: String(timestamp) };
  
  if (options.folder) paramsToSign.folder = options.folder;
  if (options.publicId) paramsToSign.public_id = options.publicId;
  if (options.tags) paramsToSign.tags = options.tags.join(',');
  if (options.context) {
    paramsToSign.context = Object.entries(options.context)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('|');
  }

  // Generate signature
  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const signatureData = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', signatureData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Prepare upload
  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  if (options.folder) formData.append('folder', options.folder);
  if (options.publicId) formData.append('public_id', options.publicId);
  if (options.tags) formData.append('tags', options.tags.join(','));
  if (paramsToSign.context) formData.append('context', paramsToSign.context);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Cloudinary SDK] Upload error:', error);
    throw new Error(`Cloudinary upload failed: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format
  };
}
