// Phase 5: Compositeur d'images via Cloudinary - Text Overlay natif

// ============= TYPES =============

export type Slide = {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
  title: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  cta?: string;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
  badge?: string;
  kpis?: Array<{ label: string; delta: string }>;
};

type TextLayer = {
  text: string;
  font?: string;
  size?: number;
  weight?: 'Regular' | 'Bold' | 'ExtraBold';
  color?: string;
  outline?: number;
  gravity?: 'north_west' | 'south_west' | 'center' | 'north' | 'south' | 'east' | 'west' | 'south_east';
  x?: number;
  y?: number;
  w?: number;
};

// ============= ENCODING & LAYER BUILDING =============

/**
 * Encode text safely for Cloudinary URLs
 */
function encodeCloudinaryText(text: string): string {
  return encodeURIComponent(text)
    .replace(/%2C/g, '%252C')
    .replace(/%2F/g, '%252F')
    .replace(/%3A/g, '%253A')
    .replace(/%23/g, '%2523')
    .replace(/\n/g, '%0A');
}

/**
 * Build a single text layer transformation for Cloudinary
 */
function buildTextLayer(layer: TextLayer): string {
  // ✅ FIX: Encode font names with spaces (e.g., "Nunito Sans" -> "Nunito%20Sans")
  const fontFamily = (layer.font || 'Inter').replace(/\s+/g, '%20');
  const fontWeight = layer.weight || 'Bold';
  const fontSize = layer.size || 64;
  const font = `${fontFamily}_${fontWeight}_${fontSize}`;
  
  const styleParams = [
    layer.color ? `co_rgb:${layer.color.replace('#', '')}` : '',
    layer.outline ? `e_outline:${layer.outline}:color_black` : '',
    layer.w ? `w_${layer.w},c_fit` : ''
  ].filter(Boolean).join(',');
  
  const encodedText = encodeCloudinaryText(layer.text);
  const base = `l_text:${font}:${encodedText}`;
  
  const gravity = layer.gravity ? `g_${layer.gravity}` : '';
  const position = (layer.x !== undefined || layer.y !== undefined) 
    ? `x_${layer.x || 0},y_${layer.y || 0}` 
    : '';
  
  const positionParams = [gravity, position].filter(Boolean).join(',');
  
  return `${base}${styleParams ? ',' + styleParams : ''}${positionParams ? ',' + positionParams : ''}/fl_layer_apply`;
}

// ============= SLIDE TYPE MAPPERS =============

/**
 * Generate text layers for hero slide (title + punchline + CTA + badge)
 */
function layersForHero(slide: Slide, primaryColor: string, secondaryColor: string): TextLayer[] {
  const layers: TextLayer[] = [];
  
  // Badge (top-left)
  if (slide.badge) {
    layers.push({
      text: slide.badge.toUpperCase(),
      font: 'Inter',
      weight: 'Bold',
      size: 28,
      color: primaryColor,
      outline: 8,
      gravity: 'north_west',
      x: 64,
      y: 64,
      w: 600
    });
  }
  
  // Main title (center)
  layers.push({
    text: slide.title,
    font: 'Inter',
    weight: 'ExtraBold',
    size: 76,
    color: 'ffffff',
    outline: 16,
    gravity: 'center',
    y: slide.badge ? -50 : 0,
    w: 900
  });
  
  // Punchline/subtitle (center-bottom)
  if (slide.punchline) {
    layers.push({
      text: slide.punchline,
      font: 'Inter',
      weight: 'Regular',
      size: 40,
      color: 'ffffff',
      outline: 10,
      gravity: 'center',
      y: 100,
      w: 900
    });
  }
  
  // CTA (bottom-center)
  if (slide.cta_primary) {
    layers.push({
      text: slide.cta_primary,
      font: 'Inter',
      weight: 'Bold',
      size: 44,
      color: primaryColor,
      outline: 12,
      gravity: 'south',
      y: 80,
      w: 700
    });
  }
  
  return layers;
}

/**
 * Generate text layers for content slides (problem/solution/impact)
 * Title + bullets list
 */
function layersForContent(slide: Slide, primaryColor: string): TextLayer[] {
  const layers: TextLayer[] = [];
  
  // Title (top-left)
  layers.push({
    text: slide.title,
    font: 'Inter',
    weight: 'ExtraBold',
    size: 68,
    color: 'ffffff',
    outline: 14,
    gravity: 'north_west',
    x: 64,
    y: 80,
    w: 900
  });
  
  // Bullets (bottom-left as list)
  if (slide.bullets && slide.bullets.length > 0) {
    const bulletText = slide.bullets.map(b => `• ${b}`).join('\n');
    layers.push({
      text: bulletText,
      font: 'Inter',
      weight: 'Regular',
      size: 42,
      color: 'ffffff',
      outline: 10,
      gravity: 'south_west',
      x: 80,
      y: 100,
      w: 950
    });
  }
  
  return layers;
}

/**
 * Generate text layers for CTA slide
 * Title + subtitle + CTA + note
 */
function layersForCTA(slide: Slide, primaryColor: string): TextLayer[] {
  const layers: TextLayer[] = [];
  
  // Title (center-top)
  layers.push({
    text: slide.title,
    font: 'Inter',
    weight: 'ExtraBold',
    size: 72,
    color: 'ffffff',
    outline: 16,
    gravity: 'center',
    y: -100,
    w: 900
  });
  
  // Subtitle (center)
  if (slide.subtitle) {
    layers.push({
      text: slide.subtitle,
      font: 'Inter',
      weight: 'Regular',
      size: 36,
      color: 'ffffff',
      outline: 10,
      gravity: 'center',
      y: 0,
      w: 900
    });
  }
  
  // Primary CTA (center-bottom)
  if (slide.cta_primary) {
    layers.push({
      text: slide.cta_primary,
      font: 'Inter',
      weight: 'Bold',
      size: 48,
      color: primaryColor,
      outline: 12,
      gravity: 'south',
      y: 150,
      w: 700
    });
  }
  
  // Note (very bottom)
  if (slide.note) {
    layers.push({
      text: slide.note,
      font: 'Inter',
      weight: 'Regular',
      size: 28,
      color: 'ffffff',
      outline: 8,
      gravity: 'south',
      y: 64,
      w: 900
    });
  }
  
  return layers;
}

// ============= MAIN FUNCTION =============

/**
 * Build complete carousel slide URL with text overlays
 * This is the NEW primary function to use for carousel rendering
 */
export function buildCarouselSlideUrl(
  backgroundPublicId: string,
  slide: Slide,
  primaryColor: string,
  secondaryColor: string
): string {
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
  
  // Select appropriate layer mapper based on slide type
  let layers: TextLayer[] = [];
  
  switch (slide.type) {
    case 'hero':
      layers = layersForHero(slide, primaryColor, secondaryColor);
      break;
    case 'problem':
    case 'solution':
    case 'impact':
      layers = layersForContent(slide, primaryColor);
      break;
    case 'cta':
      layers = layersForCTA(slide, primaryColor);
      break;
    default:
      // Fallback: simple centered title
      layers = [{
        text: slide.title,
        font: 'Inter',
        weight: 'ExtraBold',
        size: 68,
        color: 'ffffff',
        outline: 14,
        gravity: 'center',
        w: 900
      }];
  }
  
  // Build all text overlays
  const overlays = layers.map(buildTextLayer).join('/');
  
  // Final URL with quality params
  const url = `${baseUrl}/${overlays}/f_png,q_auto,cs_srgb/${backgroundPublicId}.png`;
  
  console.log(`🎨 [buildCarouselSlideUrl] Generated URL for ${slide.type} slide (${layers.length} layers)`);
  
  return url;
}

// ============= LEGACY FUNCTION (backward compatibility) =============

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
 * Legacy function - kept for backward compatibility
 * @deprecated Use buildCarouselSlideUrl instead
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
  
  const transformations: string[] = [];
  
  // Add title overlay
  if (options.title) {
    // ✅ FIX: Font already encoded above, keep it
    const titleFont = (options.titleFont || 'Inter').replace(/\s+/g, '%20');
    const titleSize = options.titleSize || 64;
    const titleWeight = options.titleWeight || 'Bold';
    const titleColor = (options.titleColor || '000000').replace('#', '');
    const encodedTitle = encodeCloudinaryText(options.title);
    
    transformations.push(
      `l_text:${titleFont}_${titleSize}_${titleWeight}:${encodedTitle},co_rgb:${titleColor},e_outline:12:color_black,g_center,y_-150,w_900,c_fit/fl_layer_apply`
    );
  }
  
  // Add subtitle overlay
  if (options.subtitle) {
    // ✅ FIX: Font already encoded above, keep it
    const subtitleFont = (options.subtitleFont || 'Inter').replace(/\s+/g, '%20');
    const subtitleSize = options.subtitleSize || 36;
    const subtitleWeight = options.subtitleWeight || 'Regular';
    const subtitleColor = (options.subtitleColor || 'ffffff').replace('#', '');
    const encodedSubtitle = encodeCloudinaryText(options.subtitle);
    
    transformations.push(
      `l_text:${subtitleFont}_${subtitleSize}_${subtitleWeight}:${encodedSubtitle},co_rgb:${subtitleColor},e_outline:10:color_black,g_center,y_-60,w_900,c_fit/fl_layer_apply`
    );
  }
  
  const url = `${baseUrl}/${transformations.join('/')}/f_png,q_auto,cs_srgb/${backgroundPublicId}.png`;
  
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
