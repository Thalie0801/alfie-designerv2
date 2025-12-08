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
  title: 35, // ✅ Réduit pour éviter troncature visuelle
  subtitle: 70,
  body: 150,
  bullet: 60,
};

// ✅ Polices Google Fonts supportées par Cloudinary
const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans', 'Poppins', 
  'Raleway', 'Playfair Display', 'Merriweather', 'Ubuntu', 'Source Sans Pro',
  'Oswald', 'Quicksand', 'Archivo', 'Libre Franklin', 'Work Sans', 'DM Sans',
  'Manrope', 'Outfit', 'Sora', 'Space Grotesk', 'Plus Jakarta Sans',
  // ✅ Polices additionnelles pour Brand Kit personnalisés
  'Baloo 2', 'Pacifico', 'Lobster', 'Dancing Script', 'Comic Neue', 'Fredoka One',
  'Caveat', 'Satisfy', 'Courgette', 'Great Vibes', 'Amatic SC', 'Permanent Marker'
];

/**
 * Normalize font to Google Fonts supported by Cloudinary
 */
function normalizeFont(font: string): string {
  if (!font) return 'Inter';
  
  // Check if font is supported (case-insensitive)
  const isSupported = GOOGLE_FONTS.some(gf => 
    gf.toLowerCase().replace(/\s+/g, '') === font.toLowerCase().replace(/\s+/g, '')
  );
  
  if (isSupported) {
    // Return the properly cased version
    const matched = GOOGLE_FONTS.find(gf => 
      gf.toLowerCase().replace(/\s+/g, '') === font.toLowerCase().replace(/\s+/g, '')
    );
    return (matched || font).replace(/\s+/g, '%20');
  }
  
  // Fallback to Inter for unsupported fonts
  console.warn(`[imageCompositor] Font "${font}" not in Google Fonts, using Inter`);
  return 'Inter';
}

/**
 * Ensure color has good contrast (not too light)
 */
function ensureContrastColor(hex: string): string {
  const clean = (hex || '').replace('#', '');
  if (!clean || clean === 'ffffff' || clean === 'fff') return '222222';
  
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  
  // Si RGB > 650 (très clair), utiliser gris foncé
  if (r + g + b > 650) return '333333';
  return clean;
}

function buildTextLayer(layer: TextLayer): string {
  const fontFamily = normalizeFont(layer.font || 'Inter');
  const fontWeight = layer.weight === 'ExtraBold' ? 'Bold' : (layer.weight || 'Bold');
  const fontSize = layer.size || 64;
  const font = `${fontFamily}_${fontSize}_${fontWeight}`;
  const textColor = (layer.color?.replace('#', '') || 'ffffff');
  const encodedText = encodeCloudinaryText(layer.text);
  
  const gravity = layer.gravity || 'center';
  const baseX = layer.x || 0;
  const baseY = layer.y || 0;
  const widthParam = layer.w ? `,w_${layer.w},c_fit` : '';
  
  const layers: string[] = [];
  
  // 1. Ombre noire décalée (profondeur et lisibilité)
  const shadowY = baseY + 4;
  const shadowX = baseX + 4;
  layers.push(`l_text:${font}:${encodedText},co_rgb:000000,o_80,g_${gravity},x_${shadowX},y_${shadowY}${widthParam}/fl_layer_apply`);
  
  // 2. Texte principal avec couleur Brand Kit
  layers.push(`l_text:${font}:${encodedText},co_rgb:${textColor},g_${gravity},x_${baseX},y_${baseY}${widthParam}/fl_layer_apply`);
  
  return layers.join('/');
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
function layersForHero(slide: Slide, primaryColor: string, secondaryColor: string, brandFonts?: BrandFonts, textColor?: string): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // ✅ Utiliser textColor du Brand Kit avec fallback
  const mainTextColor = textColor || 'ffffff';
  
  // Badge (centered above title) - ESPACEMENT AUGMENTÉ
  if (slide.badge) {
    layers.push({
      text: slide.badge.toUpperCase(),
      font: bodyFont,
      weight: 'Bold',
      size: 32, // ✅ AUGMENTÉ de 28 à 32
      color: mainTextColor,
      outline: 12,
      gravity: 'center',
      y: -220, // ✅ AUGMENTÉ de -180 à -220
      w: 700
    });
  }
  
  // Main title (CENTERED vertically) - TAILLE AUGMENTÉE
  layers.push({
    text: slide.title,
    font: titleFont,
    weight: 'ExtraBold',
    size: 92, // ✅ AUGMENTÉ de 76 à 92
    color: mainTextColor,
    outline: 22,
    gravity: 'center',
    y: -60, // ✅ AJUSTÉ pour meilleur centrage
    w: 920
  });
  
  // Punchline/subtitle (centered below title) - ESPACEMENT AUGMENTÉ
  if (slide.punchline) {
    layers.push({
      text: slide.punchline,
      font: bodyFont,
      weight: 'Bold', // ✅ Bold au lieu de Regular
      size: 48, // ✅ AUGMENTÉ de 40 à 48
      color: mainTextColor,
      outline: 14,
      gravity: 'center',
      y: 120, // ✅ AUGMENTÉ de 80 à 120
      w: 900
    });
  }
  
  // CTA (bottom-center) - ESPACEMENT AUGMENTÉ
  if (slide.cta_primary) {
    layers.push({
      text: slide.cta_primary,
      font: titleFont,
      weight: 'Bold',
      size: 52, // ✅ AUGMENTÉ de 44 à 52
      color: mainTextColor,
      outline: 16,
      gravity: 'center',
      y: 260, // ✅ AUGMENTÉ de 200 à 260
      w: 750
    });
  }
  
  return layers;
}

/**
 * Generate text layers for content slides (problem/solution/impact)
 * ✅ CENTERED: Title + bullets centrés verticalement
 * ✅ V8: Supports Brand Kit fonts
 */
function layersForContent(slide: Slide, primaryColor: string, brandFonts?: BrandFonts, textColor?: string): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // ✅ Utiliser la couleur du Brand Kit avec fallback blanc
  const mainTextColor = textColor || 'ffffff';
  
  // Determine if we have body text to adjust positioning
  const hasSubtitle = !!slide.subtitle;
  const hasBody = !!slide.punchline; // punchline = body text
  const hasBullets = slide.bullets && slide.bullets.length > 0;
  
  // ✅ ESPACEMENT VERTICAL MAXIMAL - zones bien distinctes
  let titleY = -60; // Défaut: légèrement au-dessus du centre
  if (hasSubtitle && hasBody) {
    titleY = -250; // Titre tout en haut
  } else if (hasSubtitle || hasBody) {
    titleY = -180; // Titre en haut
  } else if (hasBullets) {
    titleY = -200; // Titre en haut pour laisser place aux bullets
  }
  
  // ✅ TITRE: Taille augmentée à 86px avec font Bold
  layers.push({
    text: truncateForOverlay(slide.title, CHAR_LIMITS.title),
    font: titleFont,
    weight: 'ExtraBold',
    size: 86, // ✅ AUGMENTÉ de 64 à 86
    color: mainTextColor,
    outline: 20,
    gravity: 'center',
    y: titleY,
    w: 900
  });
  
  // ✅ Subtitle - ESPACEMENT MAXIMAL
  if (hasSubtitle) {
    const subtitleY = hasBody ? 0 : 80; // Centre ou en dessous
    layers.push({
      text: truncateForOverlay(slide.subtitle!, CHAR_LIMITS.subtitle),
      font: bodyFont,
      weight: 'Bold',
      size: 48,
      color: mainTextColor,
      outline: 12,
      gravity: 'center',
      y: subtitleY,
      w: 880
    });
  }
  
  // ✅ Body text - ESPACEMENT MAXIMAL
  if (hasBody) {
    const bodyY = hasSubtitle ? 220 : 180; // ✅ AUGMENTÉ à 220/180
    layers.push({
      text: truncateForOverlay(slide.punchline!, CHAR_LIMITS.body),
      font: bodyFont,
      weight: 'Regular',
      size: 40,
      color: mainTextColor,
      outline: 10,
      gravity: 'center',
      y: bodyY,
      w: 880
    });
  }
  
  // Bullets (CENTERED, below body or subtitle) - ESPACEMENT AUGMENTÉ
  if (hasBullets) {
    const bulletText = slide.bullets!.map(b => `• ${truncateForOverlay(b, CHAR_LIMITS.bullet)}`).join('\n');
    const bulletY = hasBody ? 280 : (hasSubtitle ? 200 : 120); // ✅ AUGMENTÉ
    layers.push({
      text: bulletText,
      font: bodyFont,
      weight: 'Regular',
      size: 42, // ✅ AUGMENTÉ de 38 à 42
      color: mainTextColor,
      outline: 12,
      gravity: 'center',
      y: bulletY,
      w: 920
    });
  }
  
  return layers;
}

/**
 * Generate text layers for CTA slide
 * Title + subtitle + CTA + note
 * ✅ V8: Supports Brand Kit fonts
 */
function layersForCTA(slide: Slide, primaryColor: string, brandFonts?: BrandFonts, textColor?: string): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // ✅ Utiliser textColor du Brand Kit avec fallback
  const mainTextColor = textColor || 'ffffff';
  
  // Title (center-top) - TAILLE AUGMENTÉE
  layers.push({
    text: slide.title,
    font: titleFont,
    weight: 'ExtraBold',
    size: 86, // ✅ AUGMENTÉ de 72 à 86
    color: mainTextColor,
    outline: 20,
    gravity: 'center',
    y: -140, // ✅ AJUSTÉ pour meilleur espacement
    w: 920
  });
  
  // Subtitle (center) - ESPACEMENT AUGMENTÉ
  if (slide.subtitle) {
    layers.push({
      text: slide.subtitle,
      font: bodyFont,
      weight: 'Bold', // ✅ Bold au lieu de Regular
      size: 44, // ✅ AUGMENTÉ de 36 à 44
      color: mainTextColor,
      outline: 12,
      gravity: 'center',
      y: 40, // ✅ AJUSTÉ de 0 à 40 pour espacement
      w: 900
    });
  }
  
  // Primary CTA (center-bottom) - TAILLE AUGMENTÉE
  if (slide.cta_primary) {
    layers.push({
      text: slide.cta_primary,
      font: titleFont,
      weight: 'Bold',
      size: 56, // ✅ AUGMENTÉ de 48 à 56
      color: mainTextColor,
      outline: 14,
      gravity: 'south',
      y: 180, // ✅ AUGMENTÉ de 150 à 180
      w: 750
    });
  }
  
  // Note (very bottom)
  if (slide.note) {
    layers.push({
      text: slide.note,
      font: bodyFont,
      weight: 'Regular',
      size: 32, // ✅ AUGMENTÉ de 28 à 32
      color: mainTextColor,
      outline: 10,
      gravity: 'south',
      y: 80, // ✅ AJUSTÉ de 64 à 80
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
function layersForCitation(slide: Slide, primaryColor: string, brandFonts?: BrandFonts, textColor?: string): TextLayer[] {
  const layers: TextLayer[] = [];
  const titleFont = brandFonts?.primary || 'Inter';
  const bodyFont = brandFonts?.secondary || 'Inter';
  
  // ✅ Utiliser textColor du Brand Kit avec fallback
  const mainTextColor = textColor || 'ffffff';
  
  // Citation principale (CENTRÉE avec guillemets + contraste) - TAILLE AUGMENTÉE
  layers.push({
    text: `"${slide.title}"`,
    font: titleFont,
    weight: 'Bold',
    size: 72, // ✅ AUGMENTÉ de 56 à 72
    color: mainTextColor,
    outline: 18,
    gravity: 'center',
    y: -60, // ✅ AJUSTÉ pour meilleur centrage
    w: 920
  });
  
  // Auteur (centré en dessous) - ESPACEMENT AUGMENTÉ
  if (slide.author) {
    layers.push({
      text: `— ${slide.author}`,
      font: bodyFont,
      weight: 'Bold', // ✅ Bold au lieu de Regular
      size: 40, // ✅ AUGMENTÉ de 32 à 40
      color: mainTextColor,
      outline: 12,
      gravity: 'center',
      y: 140, // ✅ AUGMENTÉ de 100 à 140
      w: 750
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
  brandFonts?: BrandFonts, // ✅ V8: Brand Kit fonts
  textColor?: string // ✅ V9: Brand Kit text color
): string {
  const CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')?.trim();
  if (!CLOUD_NAME) {
    throw new Error('Missing Cloudinary cloud name');
  }
  
  const cloudName = CLOUD_NAME.toLowerCase();
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
  
  // ✅ Utiliser textColor du Brand Kit avec fallback blanc
  const effectiveTextColor = textColor?.replace('#', '') || 'ffffff';
  
  // Select appropriate layer mapper based on carouselType and slide type
  let layers: TextLayer[] = [];
  
  // ✅ CITATIONS: uniquement citation + auteur
  if (carouselType === 'citations') {
    layers = layersForCitation(slide, primaryColor, brandFonts, effectiveTextColor);
    console.log(`🎨 [buildCarouselSlideUrl] CITATIONS mode - title: "${slide.title.slice(0, 30)}..." author: "${slide.author || 'N/A'}" font: "${brandFonts?.primary || 'Inter'}" textColor: #${effectiveTextColor}`);
  } else {
    // ✅ CONTENT: structure complète selon le type de slide
    switch (slide.type) {
      case 'hero':
        layers = layersForHero(slide, primaryColor, secondaryColor, brandFonts, effectiveTextColor);
        break;
      case 'problem':
      case 'solution':
      case 'impact':
        layers = layersForContent(slide, primaryColor, brandFonts, effectiveTextColor);
        break;
      case 'cta':
        layers = layersForCTA(slide, primaryColor, brandFonts, effectiveTextColor);
        break;
      default:
        // Fallback: simple centered title with brand font
        const titleFont = brandFonts?.primary || 'Inter';
        layers = [{
          text: slide.title,
          font: titleFont,
          weight: 'ExtraBold',
          size: 68,
          color: effectiveTextColor, // ✅ V9: Use brand text color
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
  
  console.log(`🎨 [buildCarouselSlideUrl] Generated URL for ${carouselType}/${slide.type} slide (${layers.length} layers, font: ${brandFonts?.primary || 'Inter'}, textColor: #${effectiveTextColor})`);
  
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
