// Phase 5: Compositeur d'images via Cloudinary - Text Overlay natif

interface CloudinaryTextOverlayOptions {
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

/**
 * Construit une URL Cloudinary avec text overlays natifs (sans upload SVG)
 * Cette approche est beaucoup plus fiable et garantit la fidélité des couleurs
 */
export function buildCloudinaryTextOverlayUrl(
  backgroundPublicId: string,
  options: CloudinaryTextOverlayOptions
): string {
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
  
  // Transformations de base pour garantir qualité et couleurs fidèles
  const qualityParams = 'f_png,q_100,cs_srgb,fl_preserve_transparency';
  const colorCorrection = 'e_brightness:5,e_saturation:8';
  
  const transformations: string[] = [qualityParams, colorCorrection];
  
  // Ajouter overlay titre si présent
  if (options.title) {
    const titleFont = (options.titleFont || 'Arial').replace(/\s+/g, '%20');
    const titleSize = options.titleSize || 64;
    const titleWeight = options.titleWeight || 'bold';
    const titleColor = (options.titleColor || '000000').replace('#', '');
    const encodedTitle = encodeURIComponent(options.title);
    
    // Text overlay Cloudinary : l_text:{font}_{size}_{weight}:{text},co_rgb:{color},g_center,y_{offset}
    transformations.push(
      `l_text:${titleFont}_${titleSize}_${titleWeight}:${encodedTitle},co_rgb:${titleColor},g_center,y_-150`
    );
  }
  
  // Ajouter overlay sous-titre si présent
  if (options.subtitle) {
    const subtitleFont = (options.subtitleFont || 'Arial').replace(/\s+/g, '%20');
    const subtitleSize = options.subtitleSize || 28;
    const subtitleWeight = options.subtitleWeight || 'normal';
    const subtitleColor = (options.subtitleColor || '5A5A5A').replace('#', '');
    const encodedSubtitle = encodeURIComponent(options.subtitle);
    
    transformations.push(
      `l_text:${subtitleFont}_${subtitleSize}_${subtitleWeight}:${encodedSubtitle},co_rgb:${subtitleColor},g_center,y_-60`
    );
  }
  
  // Appliquer les transformations de texte avec contraintes
  transformations.push('fl_relative,w_0.9,c_fit');
  
  // Construire l'URL finale
  const url = `${baseUrl}/${transformations.join('/')}/${backgroundPublicId}.png`;
  
  console.log('🎨 [buildCloudinaryTextOverlayUrl] Generated URL:', url.substring(0, 150));
  
  return url;
}

// Helper pour générer une signature Cloudinary (pour les requêtes API authentifiées)
async function generateCloudinarySignature(paramsToSign: Record<string, string>, apiSecret: string): Promise<string> {
  const sortedKeys = Object.keys(paramsToSign).sort();
  const stringToSign = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload une image background vers Cloudinary et retourne son public_id
 * Cette fonction est maintenant simplifiée et ne gère plus les SVG overlays
 */
export async function uploadBackgroundToCloudinary(
  backgroundUrl: string,
  brandId?: string,
  jobSetId?: string
): Promise<{ publicId: string; cloudinaryUrl: string }> {
  console.log('🎨 [uploadBackgroundToCloudinary] Uploading background...');
  console.log('📥 Background URL:', backgroundUrl);
  
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  const API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
  const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');
  
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  
  // 🔒 SECURITY: Require API credentials for signed uploads
  if (!API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary API credentials (CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET required)');
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  
  try {
    const bgPublicId = `alfie/${brandId || 'temp'}/${jobSetId || 'temp'}/background_${Date.now()}`;
    const bgTimestamp = Math.floor(Date.now() / 1000);
    
    const bgFormData = new FormData();
    bgFormData.append('file', backgroundUrl);
    bgFormData.append('public_id', bgPublicId);
    bgFormData.append('api_key', API_KEY);
    bgFormData.append('timestamp', bgTimestamp.toString());
    
    const bgSignature = await generateCloudinarySignature(
      { public_id: bgPublicId, timestamp: bgTimestamp.toString() },
      API_SECRET
    );
    bgFormData.append('signature', bgSignature);
    
    const bgController = new AbortController();
    const bgTimeout = setTimeout(() => bgController.abort(), 60000);
    
    try {
      const bgUploadResponse = await fetch(uploadEndpoint, {
        method: 'POST',
        body: bgFormData,
        signal: bgController.signal
      });
      
      clearTimeout(bgTimeout);
      
      if (!bgUploadResponse.ok) {
        const errorText = await bgUploadResponse.text();
        console.error('❌ Background upload failed:', errorText);
        throw new Error(`Background upload failed (${bgUploadResponse.status}): ${errorText}`);
      }
      
      const bgData = await bgUploadResponse.json();
      const uploadedPublicId = bgData.public_id;
      const cloudinaryUrl = bgData.secure_url;
      
      console.log('✅ Background uploaded:', uploadedPublicId);
      
      return { 
        publicId: uploadedPublicId, 
        cloudinaryUrl 
      };
    } catch (err) {
      clearTimeout(bgTimeout);
      console.error('❌ Background upload error:', err);
      throw new Error(`Background upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ [uploadBackgroundToCloudinary] Upload failed:', error);
    if (error instanceof Error) {
      console.error('📍 Error message:', error.message);
      console.error('📍 Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Cleanup helper to delete temporary Cloudinary resources
 */
export async function cleanupCloudinaryResource(publicId: string) {
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  const API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
  const API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');
  
  if (!CLOUD_NAME || !API_KEY || !API_SECRET || !publicId) {
    return; // silently skip if missing
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  const deleteEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
  
  const ts = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', API_KEY);
  form.append('timestamp', ts.toString());
  
  const sig = await generateCloudinarySignature(
    { public_id: publicId, timestamp: ts.toString() }, 
    API_SECRET
  );
  form.append('signature', sig);
  
  try {
    const resp = await fetch(deleteEndpoint, { method: 'POST', body: form });
    if (resp.ok) {
      console.log('🧹 Deleted Cloudinary asset:', publicId);
    } else {
      console.warn('⚠️ Failed to delete Cloudinary asset:', publicId);
    }
  } catch (e: any) {
    console.warn('⚠️ Cleanup error for', publicId, e?.message);
  }
}

/**
 * Legacy cleanup function - maintains backward compatibility
 */
export async function cleanupCloudinaryResources({
  bgPublicId,
  svgPublicId,
}: { bgPublicId?: string; svgPublicId?: string }) {
  if (bgPublicId) await cleanupCloudinaryResource(bgPublicId);
  if (svgPublicId) await cleanupCloudinaryResource(svgPublicId);
}

/**
 * Legacy compositeSlide function - now uses Cloudinary text overlays instead of SVG upload
 * Maintains backward compatibility with existing code
 */
export async function compositeSlide(
  backgroundUrl: string,
  svgTextLayer: string,
  jobSetId?: string,
  brandId?: string,
  options?: {
    primaryColor?: string;
    secondaryColor?: string;
    tintStrength?: number;
  }
): Promise<{ url: string; bgPublicId: string; svgPublicId: string }> {
  console.log('🎨 [compositeSlide] Legacy function called - using new text overlay approach');
  
  // Upload background first
  const { publicId } = await uploadBackgroundToCloudinary(
    backgroundUrl,
    brandId,
    jobSetId
  );
  
  // IMPORTANT: La fonction legacy SVG → Cloudinary text overlay nécessite parsing du SVG
  // Pour simplifier, on extrait titre/sous-titre via regex basique
  const titleMatch = svgTextLayer.match(/<text[^>]*id="title"[^>]*>([^<]+)<\/text>/i);
  const subtitleMatch = svgTextLayer.match(/<text[^>]*id="subtitle"[^>]*>([^<]+)<\/text>/i);
  
  const title = titleMatch ? titleMatch[1] : '';
  const subtitle = subtitleMatch ? subtitleMatch[1] : '';
  
  // Construire l'URL avec text overlays
  const composedUrl = buildCloudinaryTextOverlayUrl(publicId, {
    title,
    subtitle,
    titleColor: options?.primaryColor,
    subtitleColor: options?.secondaryColor,
    titleSize: 64,
    subtitleSize: 28,
    titleFont: 'Arial',
    subtitleFont: 'Arial',
    titleWeight: 'bold',
    subtitleWeight: 'normal'
  });
  
  console.log('✅ [compositeSlide] Composed URL:', composedUrl.substring(0, 100));
  
  // Retourner le format attendu par l'ancien code
  return {
    url: composedUrl,
    bgPublicId: publicId,
    svgPublicId: `${publicId}_text_overlay` // Dummy ID for compatibility
  };
}
