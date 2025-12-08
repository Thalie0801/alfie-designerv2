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
  author?: string; // ✅ Auteur pour les carrousels de citations
};

export type CarouselType = 'citations' | 'content';

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
/**
 * Truncate text for overlay display to prevent Cloudinary truncation
 */
function truncateForOverlay(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

// Character limits for overlays
const CHAR_LIMITS = {
  title: 40,
  subtitle: 70,
  body: 150,
  bullet: 60,
};

function buildTextLayer(layer: TextLayer): string {
  // ✅ FIX: Encode font names with spaces (e.g., "Nunito Sans" -> "Nunito%20Sans")
  const fontFamily = (layer.font || 'Inter').replace(/\s+/g, '%20');
  // ✅ CRITICAL FIX: Normalize ExtraBold to Bold (Cloudinary doesn't support ExtraBold)
  const fontWeight = layer.weight === 'ExtraBold' ? 'Bold' : (layer.weight || 'Bold');
  const fontSize = layer.size || 64;
  // ✅ CRITICAL FIX: Font order must be font_family_size_style
  const font = `${fontFamily}_${fontSize}_${fontWeight}`;
  
  // ✅ CONTRAST FIX: Use outline effect instead of stroke to preserve text color
  // e_outline preserves co_rgb color better than e_stroke
  const outlineWidth = layer.outline || 16;
  const textColor = layer.color ? layer.color.replace('#', '') : 'ffffff';
  
  const styleParams = [
    `co_rgb:${textColor}`, // ✅ Apply text color FIRST
    `e_outline:outer:${outlineWidth}:s_black`, // ✅ Use e_outline instead of e_stroke
    `e_shadow:60`, // ✅ Add shadow for depth
    layer.w ? `w_${layer.w},c_fit` : ''
  ].filter(Boolean).join(',');
  
  const encodedText = encodeCloudinaryText(layer.text);
  const base = `l_text:${font}:${encodedText}`;
  
  const gravity = layer.gravity ? `g_${layer.gravity}` : '';
  const position = (layer.x !== undefined || layer.y !== undefined) 
    ? `x_${layer.x || 0},y_${layer.y || 0}` 
    : '';
  
  const positionParams = [gravity, position].filter(Boolean).join(',');
  
  // ✅ CRITICAL FIX: All parameters BEFORE /fl_layer_apply
  return `${base}${styleParams ? ',' + styleParams : ''}${positionParams ? ',' + positionParams : ''}/fl_layer_apply`;
}

// ============= BRAND FONTS TYPE =============

export type BrandFonts = {
  primary?: string;
  secondary?: string;
};

// ============= SLIDE TYPE MAPPERS =============

/**
 * Generate text layers for hero slide (title + punchline + CTA + badge)
 * ✅ CENTERED: Textes centrés verticalement
 * ✅ V8: Supports Brand Kit fonts
 */
function layersForHero(slide: Slide, primaryColor: string, secondaryColor: string, brandFonts?: BrandFonts): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // Badge (centered above title)
  if (slide.badge) {
    layers.push({
      text: slide.badge.toUpperCase(),
      font: bodyFont,
      weight: 'Bold',
      size: 28,
      color: primaryColor,
      outline: 10,
      gravity: 'center',
      y: -180,
      w: 600
    });
  }
  
  // Main title (CENTERED vertically) - Use Brand Kit primary color
  layers.push({
    text: slide.title,
    font: titleFont,
    weight: 'ExtraBold',
    size: 76,
    color: primaryColor, // ✅ V8: Use brand primary color instead of white
    outline: 20,
    gravity: 'center',
    y: -40,
    w: 900
  });
  
  // Punchline/subtitle (centered below title)
  if (slide.punchline) {
    layers.push({
      text: slide.punchline,
      font: bodyFont,
      weight: 'Regular',
      size: 40,
      color: 'ffffff',
      outline: 12,
      gravity: 'center',
      y: 80,
      w: 900
    });
  }
  
  // CTA (bottom-center)
  if (slide.cta_primary) {
    layers.push({
      text: slide.cta_primary,
      font: titleFont,
      weight: 'Bold',
      size: 44,
      color: primaryColor,
      outline: 14,
      gravity: 'center',
      y: 200,
      w: 700
    });
  }
  
  return layers;
}

/**
 * Generate text layers for content slides (problem/solution/impact)
 * ✅ CENTERED: Title + bullets centrés verticalement
 * ✅ V8: Supports Brand Kit fonts
 */
function layersForContent(slide: Slide, primaryColor: string, brandFonts?: BrandFonts): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // Determine if we have body text to adjust positioning
  const hasBody = !!slide.subtitle;
  const hasBullets = slide.bullets && slide.bullets.length > 0;
  
  // Title (CENTERED, position depends on content below)
  const titleY = hasBody || hasBullets ? -120 : -40;
  layers.push({
    text: truncateForOverlay(slide.title, CHAR_LIMITS.title),
    font: titleFont,
    weight: 'ExtraBold',
    size: 68,
    color: primaryColor, // ✅ V8: Use brand primary color
    outline: 18,
    gravity: 'center',
    y: titleY,
    w: 900
  });
  
  // ✅ Body text (subtitle field) - positioned below title
  if (slide.subtitle) {
    layers.push({
      text: truncateForOverlay(slide.subtitle, CHAR_LIMITS.body),
      font: bodyFont,
      weight: 'Regular',
      size: 38,
      color: 'ffffff',
      outline: 10,
      gravity: 'center',
      y: hasBullets ? 0 : 40, // Adjust if bullets follow
      w: 900
    });
  }
  
  // Bullets (CENTERED, below body or title)
  if (hasBullets) {
    const bulletText = slide.bullets!.map(b => `• ${truncateForOverlay(b, CHAR_LIMITS.bullet)}`).join('\n');
    layers.push({
      text: bulletText,
      font: bodyFont,
      weight: 'Regular',
      size: 42,
      color: 'ffffff',
      outline: 12,
      gravity: 'center',
      y: hasBody ? 120 : 80,
      w: 950
    });
  }
  
  return layers;
}

/**
 * Generate text layers for CTA slide
 * Title + subtitle + CTA + note
 * ✅ V8: Supports Brand Kit fonts
 */
function layersForCTA(slide: Slide, primaryColor: string, brandFonts?: BrandFonts): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // Title (center-top) - Use brand primary color
  layers.push({
    text: slide.title,
    font: titleFont,
    weight: 'ExtraBold',
    size: 72,
    color: primaryColor, // ✅ V8: Use brand primary color
    outline: 16,
    gravity: 'center',
    y: -100,
    w: 900
  });
  
  // Subtitle (center)
  if (slide.subtitle) {
    layers.push({
      text: slide.subtitle,
      font: bodyFont,
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
      font: titleFont,
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
      font: bodyFont,
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
 * Generate text layers for CITATIONS carousel
 * ✅ CENTERED + CONTRAST: Citation centrée avec bon contraste
 * ✅ V8: Supports Brand Kit fonts
 */
function layersForCitation(slide: Slide, primaryColor: string, brandFonts?: BrandFonts): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // Citation principale (CENTRÉE avec guillemets + contraste) - Use brand primary color
  layers.push({
    text: `"${slide.title}"`,
    font: titleFont,
    weight: 'Bold',
    size: 56,
    color: primaryColor, // ✅ V8: Use brand primary color
    outline: 16,
    gravity: 'center',
    y: -30,
    w: 900
  });
  
  // Auteur (centré en dessous)
  if (slide.author) {
    layers.push({
      text: `— ${slide.author}`,
      font: bodyFont,
      weight: 'Regular',
      size: 32,
      color: 'ffffff',
      outline: 10,
      gravity: 'center',
      y: 100,
      w: 700
    });
  }
  
  return layers;
}

/**
 * Build complete carousel slide URL with text overlays
 * This is the NEW primary function to use for carousel rendering
 * ✅ V8: Supports Brand Kit fonts and colors
 * ✅ Supporte carouselType: 'citations' ou 'content'
 */
export function buildCarouselSlideUrl(
  backgroundPublicId: string,
  slide: Slide,
  primaryColor: string,
  secondaryColor: string,
  carouselType: CarouselType = 'content',
  brandFonts?: BrandFonts // ✅ V8: Brand Kit fonts
): string {
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
  
  // Select appropriate layer mapper based on carouselType and slide type
  let layers: TextLayer[] = [];
  
  // ✅ CITATIONS: uniquement citation + auteur
  if (carouselType === 'citations') {
    layers = layersForCitation(slide, primaryColor, brandFonts);
    console.log(`🎨 [buildCarouselSlideUrl] CITATIONS mode - title: "${slide.title.slice(0, 30)}..." author: "${slide.author || 'N/A'}" font: "${brandFonts?.primary || 'Inter'}"`);
  } else {
    // ✅ CONTENT: structure complète selon le type de slide
    switch (slide.type) {
      case 'hero':
        layers = layersForHero(slide, primaryColor, secondaryColor, brandFonts);
        break;
      case 'problem':
      case 'solution':
      case 'impact':
        layers = layersForContent(slide, primaryColor, brandFonts);
        break;
      case 'cta':
        layers = layersForCTA(slide, primaryColor, brandFonts);
        break;
      default:
        // Fallback: simple centered title with brand font
        const titleFont = brandFonts?.primary || 'Inter';
        layers = [{
          text: slide.title,
          font: titleFont,
          weight: 'ExtraBold',
          size: 68,
          color: primaryColor, // ✅ V8: Use brand primary color
          outline: 14,
          gravity: 'center',
          w: 900
        }];
    }
  }
  
  // Build all text overlays
  const overlays = layers.map(buildTextLayer).join('/');
  
  // Final URL with quality params
  const url = `${baseUrl}/${overlays}/f_png,q_auto,cs_srgb/${backgroundPublicId}.png`;
  
  console.log(`🎨 [buildCarouselSlideUrl] Generated URL for ${carouselType}/${slide.type} slide (${layers.length} layers, font: ${brandFonts?.primary || 'Inter'})`);
  
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
