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
  }
): string {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  if (!cloudName) throw new Error('CLOUDINARY_CLOUD_NAME not set');

  let transformations = [];

  // Title overlay
  if (options.title) {
    const titleFont = `${options.titleFont || 'Arial'}_${options.titleSize || 64}_${options.titleWeight || 'bold'}`;
    const titleColor = (options.titleColor || '000000').replace('#', '');
    const titleText = encodeURIComponent(options.title);
    
    transformations.push(
      `co_rgb:${titleColor}`,
      `l_text:${titleFont}:${titleText}`,
      'fl_layer_apply',
      'g_north',
      'y_100'
    );
  }

  // Subtitle overlay
  if (options.subtitle) {
    const subtitleFont = `${options.subtitleFont || 'Arial'}_${options.subtitleSize || 32}_${options.subtitleWeight || 'normal'}`;
    const subtitleColor = (options.subtitleColor || '333333').replace('#', '');
    const subtitleText = encodeURIComponent(options.subtitle);
    
    transformations.push(
      `co_rgb:${subtitleColor}`,
      `l_text:${subtitleFont}:${subtitleText}`,
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
