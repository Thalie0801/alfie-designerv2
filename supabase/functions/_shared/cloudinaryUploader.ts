// Upload et gestion Cloudinary avancée

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
}

export async function uploadToCloudinary(
  imageData: string, // base64 or URL
  options: {
    folder?: string;
    publicId?: string;
    tags?: string[];
    context?: Record<string, string>;
  }
): Promise<CloudinaryUploadResult> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  const timestamp = Math.round(Date.now() / 1000);
  
  // Build signature
  const paramsToSign: Record<string, any> = {
    timestamp,
    ...(options.folder && { folder: options.folder }),
    ...(options.publicId && { public_id: options.publicId }),
    ...(options.tags && { tags: options.tags.join(',') })
  };

  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Upload
  const formData = new FormData();
  formData.append('file', imageData);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  
  if (options.folder) formData.append('folder', options.folder);
  if (options.publicId) formData.append('public_id', options.publicId);
  if (options.tags) formData.append('tags', options.tags.join(','));
  if (options.context) {
    const contextStr = Object.entries(options.context)
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    formData.append('context', contextStr);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
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

export function buildCloudinaryTextOverlayUrl(
  publicId: string,
  options: {
    title?: string;
    subtitle?: string;
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
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME not set');

  let transformations = [];

  // Title overlay (robuste avec wrapping)
  if (options.title) {
    const titleFont = `${options.titleFont || 'Arial'}_${options.titleSize || 64}_${options.titleWeight || 'bold'}`;
    const titleColor = (options.titleColor || '000000').replace('#', '');
    // URL-encode et gérer accents FR
    const titleText = encodeURIComponent(options.title);
    const width = options.width || 960;
    const lineSpacing = options.lineSpacing || 10;
    
    transformations.push(
      `w_${width}`,
      'c_fit',
      `co_rgb:${titleColor}`,
      `l_text:${titleFont}:${titleText}`,
      'fl_text_no_trim',
      `line_spacing_${lineSpacing}`,
      'fl_layer_apply',
      'g_north',
      'y_100'
    );
  }

  // Subtitle overlay (robuste avec wrapping)
  if (options.subtitle) {
    const subtitleFont = `${options.subtitleFont || 'Arial'}_${options.subtitleSize || 32}_${options.subtitleWeight || 'normal'}`;
    const subtitleColor = (options.subtitleColor || '333333').replace('#', '');
    const subtitleText = encodeURIComponent(options.subtitle);
    const width = options.width || 960;
    const lineSpacing = options.lineSpacing || 10;
    
    transformations.push(
      `w_${width}`,
      'c_fit',
      `co_rgb:${subtitleColor}`,
      `l_text:${subtitleFont}:${subtitleText}`,
      'fl_text_no_trim',
      `line_spacing_${lineSpacing}`,
      'fl_layer_apply',
      'g_north',
      'y_180'
    );
  }

  const transformString = transformations.join(',');
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${publicId}.png`;
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
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

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
  
  const paramsToSign: Record<string, any> = {
    timestamp,
    folder,
    public_id: publicId,
    tags: tags.join(','),
    overwrite: false,
    unique_filename: false
  };

  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
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
  
  if (Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    formData.append('context', contextStr);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
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
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured');
  }

  const publicId = `brands/${metadata.brandId}/${metadata.campaign}/texts/carr_${metadata.carouselId}_v${metadata.textVersion}`;
  const tags = [metadata.brandId, metadata.campaign, 'text', 'carousel'];
  
  const timestamp = Math.round(Date.now() / 1000);
  
  const paramsToSign: Record<string, any> = {
    timestamp,
    public_id: publicId,
    tags: tags.join(','),
    resource_type: 'raw',
    overwrite: false
  };

  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&') + apiSecret;

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
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
  
  const contextStr = `type=carousel_copy|language=${metadata.language}|text_version=${metadata.textVersion}`;
  formData.append('context', contextStr);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Cloudinary] Raw text upload error:', error);
    throw new Error(`Cloudinary raw upload failed: ${response.status}`);
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
