// Upload et gestion Cloudinary avancée
import { env } from "./env.ts";
import { encodeOverlayText as encodeCloudinaryText } from "./cloudinaryText.ts";

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
}

export async function uploadToCloudinary(
  dataUrlBase64: string,
  options: {
    folder?: string;
    publicId?: string;
    tags?: string[];
    context?: Record<string, string>;
  }
): Promise<CloudinaryUploadResult> {
  const cloudName = env('CLOUDINARY_CLOUD_NAME');
  const apiKey = env('CLOUDINARY_API_KEY');
  const apiSecret = env('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  // 1) Convertir data URL → Blob
  const m = dataUrlBase64.match(/^data:(.+?);base64,(.*)$/);
  if (!m) throw new Error('Invalid data URL');
  const mime = m[1];
  const bin = atob(m[2]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const file = new Blob([u8], { type: mime });

  // 2) Build signature params
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

  // 3) Sign with SHA-1 (required by Cloudinary)
  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const signatureData = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', signatureData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 4) Upload via FormData
  const formData = new FormData();
  formData.append('file', file, options.publicId ? `${options.publicId}.png` : 'upload.png');
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  if (options.folder) formData.append('folder', options.folder);
  if (options.publicId) formData.append('public_id', options.publicId);
  if (options.tags) formData.append('tags', options.tags.join(','));
  if (paramsToSign.context) formData.append('context', paramsToSign.context);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Cloudinary] Upload error:', error);
    throw new Error(`Cloudinary upload failed: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format
  };
}

// Encode texte pour URL Cloudinary (robuste, identique à imageCompositor)
export { encodeCloudinaryText };

// Construire la chaîne de transformation pour text overlay (réutilisable pour eager)
export function buildTextOverlayTransform(options: {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  cta?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  titleColor?: string;
  subtitleColor?: string;
  titleSize?: number;
  subtitleSize?: number;
  titleFont?: string;
  subtitleFont?: string;
  titleWeight?: string;
  subtitleWeight?: string;
  width?: number;
  lineSpacing?: number;
}): string {
  const {
    title,
    subtitle = '',
    bullets = [],
    cta = '',
    ctaPrimary = '',
    ctaSecondary = '',
    titleColor = '1E1E1E',
    subtitleColor = '5A5A5A',
    titleSize = 64,
    subtitleSize = 32,
    titleFont = 'Arial',
    subtitleFont = 'Arial',
    titleWeight = 'bold',
    subtitleWeight = 'normal',
    width = 960,
    lineSpacing = 10
  } = options;

  const transformations: string[] = [];

  // Title layer
  if (title) {
    const encodedTitle = encodeCloudinaryText(title);
    const safeTitleFont = (titleFont || 'Arial').replace(/\s+/g, '%20');
    const fontStyle = titleWeight === 'bold' ? `${safeTitleFont}_${titleSize}_Bold` : `${safeTitleFont}_${titleSize}`;
    transformations.push(
      `l_text:${fontStyle}:${encodedTitle},co_rgb:${titleColor},e_outline:12:color_black,w_${width},c_fit,g_north,y_200/fl_layer_apply`
    );
  }

  // Subtitle layer (limit to 150 characters)
  if (subtitle) {
    const subtitleTrimmed = subtitle.length > 150 ? subtitle.substring(0, 147) + '...' : subtitle;
    const encodedSubtitle = encodeCloudinaryText(subtitleTrimmed);
    const safeSubtitleFont = (subtitleFont || 'Arial').replace(/\s+/g, '%20');
    const fontStyle = subtitleWeight === 'bold' ? `${safeSubtitleFont}_${subtitleSize}_Bold` : `${safeSubtitleFont}_${subtitleSize}`;
    transformations.push(
      `l_text:${fontStyle}:${encodedSubtitle},co_rgb:${subtitleColor},e_outline:10:color_black,w_${width},c_fit,g_north,y_${280 + lineSpacing}/fl_layer_apply`
    );
  }

  // Bullets layers (each bullet on its own line, limit to 5)
  if (bullets && bullets.length > 0) {
    const safeBulletFont = (subtitleFont || 'Arial').replace(/\s+/g, '%20');
    bullets.slice(0, 5).forEach((bullet, index) => {
      const bulletTrimmed = bullet.length > 80 ? bullet.substring(0, 77) + '...' : bullet;
      const encodedBullet = encodeCloudinaryText(`• ${bulletTrimmed}`);
      const yPos = 450 + (index * 60);
      transformations.push(
        `l_text:${safeBulletFont}_28:${encodedBullet},co_rgb:${subtitleColor},e_outline:10:color_black,w_${width - 120},c_fit,g_north_west,x_80,y_${yPos}/fl_layer_apply`
      );
    });
  }

  // CTA layer (bottom center, limit to 50 characters)
  const ctaText = ctaPrimary || cta;
  if (ctaText) {
    const ctaTrimmed = ctaText.length > 50 ? ctaText.substring(0, 47) + '...' : ctaText;
    const encodedCta = encodeCloudinaryText(ctaTrimmed);
    const safeCtaFont = (titleFont || 'Arial').replace(/\s+/g, '%20');
    transformations.push(
      `l_text:${safeCtaFont}_44_Bold:${encodedCta},co_rgb:${titleColor},e_outline:16:color_black,w_700,c_fit,g_south,y_80/fl_layer_apply`
    );
  }

  // Final format
  transformations.push('f_png,q_auto,cs_srgb');

  return transformations.join('/');
}

// Garantir qu'une dérivée Cloudinary existe (Strict Transformations)
export async function ensureDerived(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  publicId: string,
  eagerTransform: string
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    public_id: publicId,
    type: 'upload',
    eager: eagerTransform,
    timestamp: String(timestamp),
    api_key: apiKey,
  });

  // Signature SHA-1 (ordre alphabétique des paramètres)
  const toSign = ['eager', 'public_id', 'timestamp', 'type']
    .map(k => `${k}=${params.get(k)!}`)
    .join('&');
  const sigBuf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign + apiSecret));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  params.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/explicit`, {
    method: 'POST',
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary explicit failed ${response.status}: ${errorText}`);
  }

  return response.json();
}

export function buildCloudinaryTextOverlayUrl(
  publicId: string,
  options: {
    title?: string;
    subtitle?: string;
    bullets?: string[];
    cta?: string;
    ctaPrimary?: string;
    ctaSecondary?: string;
    titleColor?: string;
    subtitleColor?: string;
    titleSize?: number;
    subtitleSize?: number;
    titleFont?: string;
    subtitleFont?: string;
    titleWeight?: string;
    subtitleWeight?: string;
    width?: number;
    lineSpacing?: number;
  }
): string {
  const cloudName = env('CLOUDINARY_CLOUD_NAME');
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME not configured');

  const transformString = buildTextOverlayTransform(options);
  const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${publicId}`;
  return cloudinaryUrl;
}

export async function createCloudinaryFolder(
  brandId: string,
  campaign: string,
  type: 'images' | 'carousels'
): Promise<string> {
  return `brands/${brandId}/${campaign}/${type}`;
}

// ======
// NOUVELLES FONCTIONS : MÉTADONNÉES ENRICHIES + SEARCH
// ======

export interface RichMetadata {
  brandId: string;
  campaign: string;
  orderId: string;
  assetId: string;
  type: 'image' | 'carousel_slide';
  format: string;
  language: string;
  cta?: string;
  slideIndex?: number;
  textPublicId?: string;
  renderVersion: number;
  textVersion: number;
  alt: string;
}

export async function uploadWithRichMetadata(
  imageData: string,
  metadata: RichMetadata
): Promise<CloudinaryUploadResult> {
  const cloudName = env('CLOUDINARY_CLOUD_NAME');
  const apiKey = env('CLOUDINARY_API_KEY');
  const apiSecret = env('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  const folder = `brands/${metadata.brandId}/${metadata.campaign}/${
    metadata.type === 'carousel_slide' 
      ? `carousels/${metadata.orderId}` 
      : 'images'
  }`;
  
  const publicId = metadata.type === 'carousel_slide'
    ? `slide_${String(metadata.slideIndex).padStart(2,'0')}_v${metadata.renderVersion}`
    : `${metadata.orderId}_${metadata.assetId}_v${metadata.renderVersion}`;
  
  const tags = [
    metadata.brandId,
    metadata.campaign,
    metadata.type,
    metadata.format,
    metadata.language
  ];
  
  const context = {
    brand: metadata.brandId,
    campaign: metadata.campaign,
    type: metadata.type,
    format: metadata.format,
    language: metadata.language,
    render_version: `${metadata.renderVersion}`,
    text_version: `${metadata.textVersion}`,
    alt: metadata.alt,
    ...(metadata.cta && { cta: metadata.cta }),
    ...(metadata.slideIndex && { slide_index: `${metadata.slideIndex}` }),
    ...(metadata.textPublicId && { text_public_id: metadata.textPublicId })
  };

  const timestamp = Math.round(Date.now() / 1000);
  
  // IMPORTANT: Calculer contextStr AVANT signature pour l'inclure dans paramsToSign
  const contextStr = Object.keys(context).length > 0
    ? Object.entries(context).map(([k, v]) => `${k}=${v}`).join('|')
    : '';
  
  const paramsToSign: Record<string, any> = {
    timestamp,
    folder,
    public_id: publicId,
    tags: tags.join(','),
    overwrite: false,
    unique_filename: false,
    ...(contextStr && { context: contextStr })
  };

  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  console.log('[Cloudinary] Signing keys:', Object.keys(paramsToSign).sort());

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);
  formData.append('public_id', publicId);
  formData.append('tags', tags.join(','));
  formData.append('overwrite', 'false');
  formData.append('unique_filename', 'false');
  
  if (contextStr) {
    formData.append('context', contextStr);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail;
    try {
      errorDetail = JSON.parse(errorText);
    } catch {
      errorDetail = errorText;
    }
    console.error('[Cloudinary] Upload failed:', {
      status: response.status,
      error: errorDetail,
      publicId,
      folder,
      timestamp
    });
    throw new Error(`Cloudinary upload failed: ${response.status} - ${JSON.stringify(errorDetail)}`);
  }

  const result = await response.json();
  
  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format
  };
}

export async function uploadTextAsRaw(
  textJson: any,
  metadata: {
    brandId: string;
    campaign: string;
    carouselId: string;
    textVersion: number;
    language: string;
  }
): Promise<string> {
  const cloudName = env('CLOUDINARY_CLOUD_NAME');
  const apiKey = env('CLOUDINARY_API_KEY');
  const apiSecret = env('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  const publicId = `brands/${metadata.brandId}/${metadata.campaign}/texts/carr_${metadata.carouselId}_v${metadata.textVersion}`;
  const tags = [metadata.brandId, metadata.campaign, 'text', 'carousel'];
  
  const timestamp = Math.round(Date.now() / 1000);
  
  // IMPORTANT: Calculer context AVANT signature pour l'inclure dans paramsToSign
  const contextStr = `type=carousel_copy|language=${metadata.language}|text_version=${metadata.textVersion}`;
  
  // CRITICAL: Ne PAS inclure resource_type dans la signature pour raw uploads
  const paramsToSign: Record<string, any> = {
    context: contextStr,
    overwrite: false,
    public_id: publicId,
    tags: tags.join(','),
    timestamp
  };

  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  console.log('[Cloudinary] Raw upload signing keys:', Object.keys(paramsToSign).sort());

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  const jsonBlob = new Blob([JSON.stringify(textJson)], { type: 'application/json' });
  formData.append('file', jsonBlob);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('public_id', publicId);
  formData.append('tags', tags.join(','));
  formData.append('resource_type', 'raw');
  formData.append('overwrite', 'false');
  formData.append('context', contextStr);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail;
    try {
      errorDetail = JSON.parse(errorText);
    } catch {
      errorDetail = errorText;
    }
    console.error('[Cloudinary] Raw text upload failed:', {
      status: response.status,
      error: errorDetail,
      publicId,
      timestamp
    });
    throw new Error(`Cloudinary raw upload failed: ${response.status} - ${JSON.stringify(errorDetail)}`);
  }

  const result = await response.json();
  return result.public_id;
}

export interface SearchFilters {
  brandId?: string;
  campaign?: string;
  type?: 'image' | 'carousel_slide';
  format?: string;
  language?: string;
  textPublicId?: string;
  slideIndex?: number;
}

export async function searchCloudinaryAssets(filters: SearchFilters): Promise<any[]> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  const expressions = [];
  
  if (filters.brandId && filters.campaign) {
    expressions.push(`folder="brands/${filters.brandId}/${filters.campaign}/*"`);
  }
  if (filters.type) {
    expressions.push(`context.type="${filters.type}"`);
  }
  if (filters.textPublicId) {
    expressions.push(`context.text_public_id="${filters.textPublicId}"`);
  }
  if (filters.slideIndex) {
    expressions.push(`context.slide_index="${filters.slideIndex}"`);
  }
  if (filters.format) {
    expressions.push(`context.format="${filters.format}"`);
  }
  if (filters.language) {
    expressions.push(`context.language="${filters.language}"`);
  }
  
  const expression = expressions.join(' AND ');
  
  const authString = btoa(`${apiKey}:${apiSecret}`);
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expression,
        max_results: 500,
        sort_by: [{ created_at: 'desc' }],
        with_field: ['context', 'tags']
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Cloudinary] Search error:', error);
    throw new Error(`Cloudinary search failed: ${response.status}`);
  }
  
  const result = await response.json();
  return result.resources || [];
}
