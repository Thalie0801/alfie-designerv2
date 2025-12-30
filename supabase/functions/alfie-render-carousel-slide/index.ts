// functions/alfie-render-carousel-slide/index.ts
// v3.0.0 — Premium mode with native text integration (no SVG overlay)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { uploadTextAsRaw } from "../_shared/cloudinaryUploader.ts";
import { buildCarouselSlideUrl, Slide, CarouselType, BrandFonts } from "../_shared/imageCompositor.ts";
import { getCarouselModel, getVertexCarouselModel, LOVABLE_MODELS } from "../_shared/aiModels.ts";
import { callVertexGeminiImage, isVertexGeminiConfigured } from "../_shared/vertexGeminiImage.ts";
import { 
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY, 
  INTERNAL_FN_SECRET,
  LOVABLE_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET
} from "../_shared/env.ts";
import { renderSlideToSVG, SlideContent } from "../_shared/slideRenderer.ts";
import { SlideTemplate, TextLayer } from "../_shared/slideTemplates.ts";

import { corsHeaders } from "../_shared/cors.ts";
type Lang = "FR" | "EN";

type CarouselMode = 'standard' | 'premium' | 'background_only';
type ColorMode = 'vibrant' | 'pastel';
type VisualStyle = 'background' | 'character' | 'product'; // ✅ NEW: Style visuel adaptatif

interface BrandKit {
  name?: string;
  niche?: string;
  voice?: string;
  pitch?: string;
  adjectives?: string[];
  visual_types?: string[];
  visual_mood?: string[];
  avoid_in_visuals?: string;
  palette?: string[];
  fonts?: { primary?: string; secondary?: string }; // ✅ V8: Brand Kit fonts
  avatar_url?: string | null; // ✅ V10: Avatar/mascotte pour mode character
  text_color?: string | null; // ✅ V10: Couleur de texte personnalisée
}

interface SlideRequest {
  userId?: string;               // ✅ Required or deduced from orderId
  prompt: string;
  globalStyle: string;
  slideContent: {
    title: string;
    subtitle?: string;
    body?: string;
    bullets?: string[];
    alt: string;
    author?: string; // ✅ Auteur pour les citations
  };
  brandId: string;
  orderId: string;
  orderItemId?: string | null;
  carouselId: string;
  slideIndex: number;
  totalSlides: number;
  aspectRatio: string;           // "4:5" / "1080x1350" etc.
  textVersion: number;
  renderVersion: number;
  campaign: string;
  language?: Lang | string;
  requestId?: string | null;
  useBrandKit?: boolean;        // ✅ Contrôle si le Brand Kit doit être appliqué
  carouselMode?: CarouselMode;  // ✅ Standard (overlay) ou Premium (texte intégré nativement)
  carouselType?: CarouselType;  // ✅ NOUVEAU: citations ou content
  brandKit?: BrandKit;          // ✅ NOUVEAU: Brand Kit V2 complet
  referenceImageUrl?: string | null; // ✅ NOUVEAU: Image de référence pour le style
  colorMode?: ColorMode;        // ✅ NOUVEAU: Coloré ou Pastel
  visualStyle?: VisualStyle;    // ✅ NOUVEAU: Style visuel (background/character/product)
}

type GenSize = { w: number; h: number };

// ✅ Modèles Lovable AI (fallback uniquement)
const MODEL_IMAGE_STANDARD = LOVABLE_MODELS.image_standard;
const MODEL_IMAGE_PREMIUM = LOVABLE_MODELS.image_premium;

const AR_MAP: Record<string, GenSize> = {
  "1:1":     { w: 1080, h: 1080 },
  "4:5":     { w: 1080, h: 1350 },
  "9:16":    { w: 1080, h: 1920 },
  "16:9":    { w: 1920, h: 1080 },
  "2:3":     { w: 1080, h: 1620 },  // Pinterest
  "yt-thumb": { w: 1280, h: 720 },  // YouTube thumbnail
};

const PIXEL_TO_AR: Record<string, string> = {
  "1080x1350": "4:5",
  "1080x1920": "9:16",
  "1920x1080": "16:9",
  "1080x1080": "1:1",
  "1080x1620": "2:3",
};

// -----------------------------
// Small helpers
// -----------------------------
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizeLang(l?: string): Lang {
  return (l?.toUpperCase() === "EN" ? "EN" : "FR") as Lang;
}

function normalizeAspectRatio(ar: string | undefined): { ar: string; size: GenSize } {
  let ratio = (ar || "").trim();

  if (ratio.includes("x")) {
    const key = ratio.toLowerCase();
    ratio = PIXEL_TO_AR[key] || "4:5";
    console.log(`[render-slide] ℹ️ normalized pixel AR "${ar}" -> "${ratio}"`);
  }
  if (!AR_MAP[ratio]) {
    console.warn(`[render-slide] ⚠️ unknown AR "${ar}", fallback to 4:5`);
    ratio = "4:5";
  }
  return { ar: ratio, size: AR_MAP[ratio] };
}

function getSlideRole(index: number, total: number): string {
  if (index === 0) return "HOOK/INTRODUCTION";
  if (index === total - 1) return "CALL-TO-ACTION/CONCLUSION";
  if (index === 1) return "PROBLEM/CONTEXT";
  if (index === total - 2) return "SOLUTION/BENEFIT";
  return "KEY POINT/INSIGHT";
}

/**
 * Build prompt for STANDARD mode (PURE IMAGE ONLY - NO TEXT AT ALL)
 * Text is added AFTER via Cloudinary overlay
 * ✅ ADAPTATIF: utilise le Brand Kit (niche, visual_types, visual_mood) pour le style
 * ✅ COLORMODE: adapte la palette selon vibrant/pastel
 */
function buildImagePromptStandard(
  globalStyle: string, 
  prompt: string, 
  useBrandKit: boolean,
  slideContent: { title: string; subtitle?: string; alt: string },
  slideIndex: number,
  totalSlides: number,
  brandKit?: BrandKit, // ✅ NEW: Brand Kit pour personnalisation
  colorMode: ColorMode = 'vibrant' // ✅ NEW: Mode couleurs
): string {
  // ✅ Déterminer le style visuel basé sur le Brand Kit
  let visualStyle = "modern professional design";
  let visualElements = "soft 3D geometric elements, glowing orbs, smooth shapes";
  
  // ✅ COLORMODE: adapter les couleurs selon le choix utilisateur
  let colorScheme = colorMode === 'pastel' 
    ? "soft pastel colors, gentle muted tones, delicate hues, subtle gradients"
    : "rich saturated colors with vibrant gradients";
  
  if (useBrandKit && brandKit) {
    // Adapter au visual_types du Brand Kit
    const visualType = brandKit.visual_types?.[0];
    if (visualType === "illustrations_3d") {
      visualElements = "3D rendered objects with depth and lighting, floating elements";
    } else if (visualType === "illustrations_2d") {
      visualElements = "flat 2D illustration style with clean shapes";
    } else if (visualType === "photos") {
      visualElements = "photorealistic professional imagery";
    } else if (visualType === "doodle") {
      visualElements = "hand-drawn doodle style sketches";
    } else if (visualType === "mockups") {
      visualElements = "professional product mockup style";
    }
    
    // Adapter au visual_mood - RESPECTER le colorMode
    const mood = brandKit.visual_mood?.[0];
    if (colorMode === 'pastel') {
      // ✅ Mode PASTEL: toujours des tons doux
      colorScheme = "soft pastel colors, gentle muted tones, delicate hues, light and airy palette";
    } else {
      // ✅ Mode VIBRANT: adapter au mood du Brand Kit
      if (mood === "coloré") colorScheme = "vibrant bold saturated colors";
      else if (mood === "minimaliste") colorScheme = "clean minimal color palette, negative space, subtle colors";
      else if (mood === "pastel") colorScheme = "soft pastel colors, gentle tones";
      else if (mood === "contrasté") colorScheme = "high contrast dramatic colors";
      else if (mood === "lumineux") colorScheme = "bright luminous colors with glow effects";
      else if (mood === "sombre") colorScheme = "deep dark tones with accent highlights";
    }
    
    // Adapter au niche/secteur
    if (brandKit.niche) {
      visualStyle = `${brandKit.niche} industry aesthetic`;
    }
  }
  
  // Extraire le thème du prompt utilisateur
  const theme = prompt?.trim() || "professional social media content";
  
  // Style hint du globalStyle si disponible
  const additionalStyle = (useBrandKit && globalStyle) ? `, ${globalStyle}` : "";
  
  const colorModeLabel = colorMode === 'pastel' ? 'SOFT PASTEL' : 'RICH, COLORFUL';
  
  return `Create a ${colorModeLabel} background image for social media.

THEME: ${theme}
INDUSTRY: ${visualStyle}${additionalStyle}
COLOR SCHEME: ${colorScheme}
VISUAL ELEMENTS: ${visualElements}

CRITICAL REQUIREMENTS:
- Generate a ${colorModeLabel} image - NOT white, NOT blank, NOT empty
- Image must reflect the THEME: ${theme}
- Modern social media aesthetic with depth and dimension
- Leave clean central area for text overlay

ABSOLUTE RULES:
- NO TEXT whatsoever - no letters, words, numbers, labels, typography
- NO white/empty backgrounds - always colorful (${colorMode === 'pastel' ? 'soft pastel tones' : 'saturated colors'})
- Match the visual style to the industry/theme

OUTPUT: A beautiful, thematic background image with NO text.`
}

/**
 * ✅ NEW: Build prompt for CHARACTER mode (avatars, personnages 3D style Pixar)
 * Génère des personnages/avatars selon le Brand Kit
 * ✅ V10: Si avatar_url fourni, demande de reproduire CE personnage exactement
 */
function buildImagePromptCharacter(
  userPrompt: string,
  brandKit: BrandKit | undefined,
  useBrandKit: boolean,
  slideIndex: number,
  totalSlides: number,
  colorMode: ColorMode = 'vibrant',
  hasAvatarReference: boolean = false // ✅ NEW: Indique si une image de référence est fournie
): string {
  // Déterminer le style de personnage selon le Brand Kit
  let characterStyle = "3D cartoon character in Pixar/Disney animation style, expressive face, friendly appearance";
  let characterDescription = "professional young adult";
  
  // ✅ V10: Si avatar de référence, instruction de cohérence stricte
  let referenceInstruction = "";
  if (hasAvatarReference) {
    referenceInstruction = `
REFERENCE CHARACTER (PROVIDED IMAGE):
- Use the provided reference image as the EXACT character to feature
- Reproduce this SAME character with IDENTICAL appearance, style, colors, and design
- The character must be recognizable as the SAME character across all slides
- Maintain consistent proportions, colors, expressions style, and visual identity`;
    characterStyle = "the EXACT character from the reference image";
    characterDescription = "the character shown in the reference, maintaining perfect visual consistency";
  } else if (useBrandKit && brandKit) {
    const visualType = brandKit.visual_types?.[0];
    if (visualType === "avatars_3d" || visualType === "illustrations_3d") {
      characterStyle = "3D rendered cartoon character in Pixar/Disney style, smooth rendering, expressive features";
    } else if (visualType === "avatars_flat" || visualType === "illustrations_2d") {
      characterStyle = "flat 2D illustrated character, modern vector art style, clean lines";
    } else if (visualType === "mascotte") {
      characterStyle = "cute brand mascot character, friendly cartoon animal or figure, memorable design";
    }
    
    // Adapter au niche
    if (brandKit.niche) {
      characterDescription = `${brandKit.niche} professional`;
    }
  }
  
  const colorScheme = colorMode === 'pastel' 
    ? "soft pastel color palette, gentle tones"
    : "vibrant saturated colors";
  
  const slideRole = getSlideRole(slideIndex, totalSlides);
  const theme = userPrompt?.trim() || "professional content";
  
  return `Create a social media image featuring a CHARACTER.
${referenceInstruction}
CHARACTER: ${characterStyle}
PERSON: ${characterDescription} engaged in activity related to: ${theme}
MOOD: ${colorScheme}, modern professional aesthetic
SCENE: Clean background with soft depth, ${slideRole.toLowerCase()}

CRITICAL REQUIREMENTS:
- Character must be the CENTRAL focus of the image
${hasAvatarReference ? "- MUST reproduce the EXACT same character from the reference image on EVERY slide" : "- Character should have consistent design and style"}
- Character should express emotion/energy related to the content
- Leave space at top for text overlay (added separately)
- Modern social media aesthetic with professional quality

ABSOLUTE RULES:
- NO TEXT whatsoever in the image - no letters, words, labels
- Character should be well-lit and clearly visible
- Background should complement, not distract from character

OUTPUT: A professional image with ${hasAvatarReference ? "the EXACT reference character" : "an expressive character"} and NO text.`;
}

/**
 * ✅ NEW: Build prompt for PRODUCT mode (mise en scène produit)
 * Utilise l'image de référence uploadée comme produit central
 */
function buildImagePromptProduct(
  userPrompt: string,
  brandKit: BrandKit | undefined,
  useBrandKit: boolean,
  referenceImageUrl: string | null | undefined,
  slideIndex: number,
  totalSlides: number,
  colorMode: ColorMode = 'vibrant'
): string {
  // Si pas d'image de référence, fallback vers un style produit générique
  const hasReference = !!referenceImageUrl;
  
  let sceneStyle = "professional product photography, elegant mockup setting";
  let backgroundStyle = "clean gradient background with subtle shadows";
  
  if (useBrandKit && brandKit) {
    if (brandKit.niche) {
      sceneStyle = `${brandKit.niche} product showcase, professional setting`;
    }
    const mood = brandKit.visual_mood?.[0];
    if (mood === "minimaliste") {
      backgroundStyle = "minimal clean background with soft shadows";
    } else if (mood === "lumineux") {
      backgroundStyle = "bright luminous background with soft glow";
    } else if (mood === "sombre") {
      backgroundStyle = "dark elegant background with accent lighting";
    }
  }
  
  const colorScheme = colorMode === 'pastel' 
    ? "soft pastel tones, gentle colors"
    : "rich saturated colors";
  
  const slideRole = getSlideRole(slideIndex, totalSlides);
  const theme = userPrompt?.trim() || "product showcase";
  
  const referenceInstruction = hasReference 
    ? `Use the provided reference image as the MAIN PRODUCT to feature centrally.`
    : `Create a generic product mockup scene suitable for: ${theme}`;
  
  return `Create a professional PRODUCT SHOWCASE image.

${referenceInstruction}

SCENE: ${sceneStyle}
BACKGROUND: ${backgroundStyle}
COLORS: ${colorScheme}
CONTEXT: ${theme}
SLIDE ROLE: ${slideRole}

CRITICAL REQUIREMENTS:
- Product must be the CENTRAL subject of the image
- Professional e-commerce/marketing quality
- Create an attractive lifestyle or studio setting around the product
- Leave space at top for text overlay (added separately)

ABSOLUTE RULES:
- NO TEXT whatsoever in the image - no labels, prices, descriptions
- Product should be well-lit and clearly visible
- Background should enhance, not compete with the product

OUTPUT: A stunning product showcase image with NO text.`;
}

/**
 * Tronquer un texte intelligemment avec ellipsis
 */
function truncateText(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || "";
  const cutIndex = text.lastIndexOf(' ', maxChars - 3);
  return text.substring(0, cutIndex > maxChars * 0.5 ? cutIndex : maxChars - 3).trim() + "...";
}

/**
 * Build prompt for PREMIUM mode - BACKGROUND ONLY (NO TEXT)
 * ✅ V8: Gemini 3 Pro génère un fond haute qualité SANS AUCUN texte
 * ✅ Le texte est ajouté ensuite via Cloudinary overlay avec fonts du Brand Kit
 * ✅ COLORMODE: adapte la palette selon vibrant/pastel
 */
function buildImagePromptPremium(
  userPrompt: string,
  brandKit: BrandKit | undefined,
  useBrandKit: boolean,
  slideIndex: number,
  totalSlides: number,
  referenceImageUrl?: string | null,
  colorMode: ColorMode = 'vibrant' // ✅ NEW: Mode couleurs
): string {
  // ✅ Style visuel enrichi par le Brand Kit V2
  let visualStyle = "vibrant gradient background, rich saturated colors, elegant modern design";
  
  // ✅ COLORMODE: adapter les couleurs selon le choix utilisateur
  let colorHint = colorMode === 'pastel' 
    ? "soft pastels: blush pink, mint green, lavender, baby blue, peach"
    : "blues, purples, pinks, teals, warm oranges";
  
  if (useBrandKit && brandKit) {
    const styleParts: string[] = [];
    
    if (brandKit.niche) {
      styleParts.push(`${brandKit.niche} industry aesthetic`);
    }
    if (brandKit.visual_mood?.length) {
      // ✅ COLORMODE: override mood si pastel demandé
      if (colorMode === 'pastel') {
        styleParts.push("soft pastel, gentle, delicate mood");
      } else {
        styleParts.push(brandKit.visual_mood.slice(0, 2).join(", ") + " mood");
      }
    }
    if (brandKit.visual_types?.length) {
      const type = brandKit.visual_types[0];
      if (type === "illustrations_3d") styleParts.push("3D rendered elements with depth");
      else if (type === "illustrations_2d") styleParts.push("flat 2D illustration style");
      else if (type === "photos") styleParts.push("photorealistic quality");
      else if (type === "mockups") styleParts.push("professional mockup style");
    }
    if (brandKit.palette?.length) {
      // ✅ Utiliser les couleurs du palette comme hint
      colorHint = colorMode === 'pastel' 
        ? "soft pastel versions of brand colors"
        : "brand colors from palette";
      styleParts.push("harmonious brand color palette with rich saturation");
    }
    if (brandKit.pitch) {
      styleParts.push(`Brand essence: ${brandKit.pitch}`);
    }
    
    if (styleParts.length > 0) {
      visualStyle = styleParts.join(", ");
    }
  }
  
  const avoid = brandKit?.avoid_in_visuals || "";

  const referenceInstruction = referenceImageUrl ? `
Use the provided reference image as style inspiration for colors and composition.` : "";

  const slideRole = getSlideRole(slideIndex, totalSlides);
  
  const colorModeLabel = colorMode === 'pastel' ? 'SOFT PASTEL' : 'VIBRANT, COLORFUL';
  const colorDescription = colorMode === 'pastel'
    ? "soft, muted, gentle tones with delicate hues"
    : "rich, saturated with visible color transitions";

  // ✅ PROMPT SIMPLIFIÉ ET RENFORCÉ POUR RESPECTER LE COLORMODE
  return `Create a ${colorModeLabel} premium background image.

THEME: ${userPrompt}
STYLE: ${visualStyle}
COLORS: Use ${colorDescription} ${colorHint} - NO WHITE BACKGROUND
SLIDE: ${slideRole} (${slideIndex + 1}/${totalSlides})
${referenceInstruction}

CRITICAL REQUIREMENTS:
- Generate a ${colorModeLabel} image - NOT white, NOT blank, NOT empty
- ${colorMode === 'pastel' ? 'Soft pastel tones, gentle gradients, muted palette' : 'Beautiful gradients with visible color transitions'}
- Soft 3D geometric elements, glowing orbs, smooth flowing shapes
- Modern social media aesthetic with depth and dimension
- Leave clean central area for text overlay (added separately)

ABSOLUTE RULES:
- Image MUST be ${colorMode === 'pastel' ? 'soft and gentle in pastel tones' : 'colorful and vibrant with saturated colors'}
- NO TEXT whatsoever - no letters, words, numbers, labels, typography
- Background must have visible colors and patterns, never pure white

${avoid ? `AVOID: ${avoid}` : ""}

OUTPUT: A stunning, ${colorMode === 'pastel' ? 'pastel' : 'colorful'} abstract background with ZERO text.`;
}

/**
 * ✅ NEW: Build prompt for COMPLETE CAROUSEL with integrated text
 * Nano Banana Pro génère l'image + texte directement (centré)
 * Pour carouselMode = 'standard' avec texte existant
 */
function buildImagePromptWithText(
  globalStyle: string,
  prompt: string,
  slideContent: { title: string; subtitle?: string; body?: string; bullets?: string[] },
  slideIndex: number,
  totalSlides: number,
  brandKit?: BrandKit,
  colorMode: ColorMode = 'vibrant'
): string {
  const slideRole = getSlideRole(slideIndex, totalSlides);
  const colorModeLabel = colorMode === 'pastel' ? 'soft pastel' : 'vibrant colorful';
  
  // ✅ Palette du Brand Kit ou fallback
  const palette = brandKit?.palette?.filter(c => c && c !== '#ffffff')?.slice(0, 3) || [];
  const colorHint = palette.length > 0 
    ? `Primary colors: ${palette.join(', ')}` 
    : 'Use modern gradient colors (blues, purples, pinks)';
  
  // ✅ Construire le texte à intégrer
  const textLines: string[] = [];
  if (slideContent.title) textLines.push(`TITLE: "${slideContent.title}"`);
  if (slideContent.subtitle) textLines.push(`SUBTITLE: "${slideContent.subtitle}"`);
  if (slideContent.body) textLines.push(`BODY: "${slideContent.body}"`);
  if (slideContent.bullets?.length) {
    textLines.push(`BULLET POINTS:\n${slideContent.bullets.map(b => '• ' + b).join('\n')}`);
  }
  
  // ✅ NEW: Adapter le style typographique selon le Brand Kit visual_types
  const visualType = brandKit?.visual_types?.[0] || 'modern';
  let typographyStyle = "clean, modern sans-serif typography with soft shadow";
  let visualElements = "soft 3D geometric elements, glowing orbs, smooth shapes";
  
  if (visualType === "illustrations_3d" || visualType === "3d_pixar_style") {
    typographyStyle = "3D BUBBLE LETTERS - puffy, rounded, inflated look with soft shadows and highlights. Pixar/Disney cartoon style text";
    visualElements = "3D rendered objects with depth, organic 3D shapes, Pixar-style backgrounds";
  } else if (visualType === "illustrations_2d") {
    typographyStyle = "flat 2D illustration style text, bold colors, clean lines";
    visualElements = "flat 2D illustration elements, bold shapes, vector-style graphics";
  } else if (visualType === "doodle") {
    typographyStyle = "hand-drawn, playful typography with organic strokes, sketch-style letters";
    visualElements = "hand-drawn doodles, sketchy elements, playful illustrations";
  } else if (visualType === "photorealistic") {
    typographyStyle = "elegant serif or modern sans-serif typography with subtle shadow for readability";
    visualElements = "realistic textures, professional photography style backgrounds";
  } else if (visualType === "mockup" || visualType === "corporate") {
    typographyStyle = "clean, professional corporate typography, minimal and refined";
    visualElements = "clean geometric shapes, professional business aesthetic";
  }
  
  // ✅ Couleur de texte du Brand Kit ou blanc par défaut
  const textColor = brandKit?.text_color || '#FFFFFF';
  const textColorName = textColor.toLowerCase() === '#ffffff' ? 'WHITE' : textColor;
  
  // ✅ Mood visuel du Brand Kit
  const visualMood = brandKit?.visual_mood?.join(', ') || colorModeLabel;
  
  // ✅ Adjectives pour le ton général
  const brandPersonality = brandKit?.adjectives?.join(', ') || 'professional, modern';
  
  // ✅ Éléments à éviter
  const avoid = brandKit?.avoid_in_visuals || '';
  
  return `Create a ${colorModeLabel} social media carousel slide with INTEGRATED TEXT.

THEME: ${prompt}
STYLE: ${globalStyle || 'modern professional'}
SLIDE: ${slideRole} (${slideIndex + 1}/${totalSlides})
${colorHint}
VISUAL MOOD: ${visualMood}
BRAND PERSONALITY: ${brandPersonality}

📝 TEXT TO DISPLAY (CENTERED on image):
${textLines.join('\n')}

TYPOGRAPHY STYLE (CRITICAL - follow exactly):
${typographyStyle}
- Text color: ${textColorName} with contrasting shadow/stroke for readability
- Title: LARGE, bold, prominent
- Subtitle/Body: Smaller, below title
- ALL text MUST be perfectly CENTERED horizontally and vertically

VISUAL ELEMENTS: ${visualElements}

CRITICAL REQUIREMENTS:
- Generate a ${colorModeLabel} background - NO white/blank backgrounds
- TEXT MUST BE CENTERED horizontally and vertically on the image
- Text is the MAIN FOCUS - clearly legible and prominent
- Modern social media aesthetic with depth and dimension
- Leave comfortable margins around text (10% each side)

ABSOLUTE RULES (MANDATORY):
- The image MUST contain the EXACT text provided above. If text is missing, the output is INVALID.
- Follow the TYPOGRAPHY STYLE instructions exactly
- Background: ${colorMode === 'pastel' ? 'soft pastel tones' : 'vibrant gradients'}
- NO placeholder text, NO additional words beyond what is specified
${avoid ? `- AVOID: ${avoid}` : ''}

OUTPUT: A stunning carousel slide with ${colorModeLabel} background, ${typographyStyle.split(' - ')[0]} text, perfectly centered and prominent.`;
}

/**
 * Create a dynamic SVG template based on aspect ratio
 * ✅ Texte centré horizontalement et verticalement dans la moitié supérieure
 */
function createDynamicTemplate(aspectRatio: string, brandKit?: BrandKit | null): SlideTemplate {
  let width: number, height: number;
  
  // ✅ Cas spécial: YouTube Thumbnail (format fixe 1280x720)
  if (aspectRatio === 'yt-thumb') {
    width = 1280;
    height = 720;
  } else {
    const [wRatio, hRatio] = aspectRatio.split(':').map(Number);
    
    // ✅ Calculer les dimensions selon que le format est portrait ou paysage
    if (wRatio > hRatio) {
      // Format PAYSAGE (16:9) → width = 1920, calculer height
      width = 1920;
      height = Math.round(1920 * (hRatio / wRatio)); // 1920 × (9/16) = 1080
    } else if (hRatio > wRatio) {
      // Format PORTRAIT (9:16, 4:5) → width = 1080, calculer height
      width = 1080;
      height = Math.round(1080 * (hRatio / wRatio));
    } else {
      // Format CARRÉ (1:1)
      width = 1080;
      height = 1080;
    }
  }
  
  // ✅ Tailles de police adaptatives selon l'aspect ratio
  const titleSize = height > 1200 ? 72 : 64;
  const subtitleSize = height > 1200 ? 40 : 36;
  const bodySize = height > 1200 ? 32 : 28;
  
  // ✅ Positions centrées dans la moitié supérieure
  const titleY = Math.round(height * 0.25); // 25% du haut
  const subtitleY = Math.round(height * 0.38); // 38% du haut
  const bodyY = Math.round(height * 0.50); // 50% du haut (nouveau)
  
  // ✅ Police du Brand Kit ou fallback
  const fontFamily = brandKit?.name || 'Inter';
  
  const template: SlideTemplate = {
    type: 'hero',
    requiredFields: ['title'],
    optionalFields: ['subtitle', 'punchline', 'bullets'],
    charLimits: {
      title: { min: 5, max: 40 },      // ✅ Réduit de 60 à 40 pour cohérence
      subtitle: { min: 10, max: 60 },  // ✅ Réduit de 120 à 60 pour cohérence
      punchline: { min: 10, max: 120 }, // ✅ Réduit de 200 à 120 pour cohérence
    },
    layout: { 
      width, 
      height, 
      safeZones: { 
        top: Math.round(height * 0.10), 
        bottom: Math.round(height * 0.30), 
        left: Math.round(width * 0.10), 
        right: Math.round(width * 0.10) 
      } 
    },
    textLayers: [
      { 
        id: 'title', 
        type: 'title', 
        font: fontFamily, 
        size: titleSize, 
        weight: 700, 
        color: '#FFFFFF',
        position: { x: width / 2, y: titleY }, 
        maxWidth: Math.round(width * 0.80), 
        maxLines: 3, 
        align: 'center' 
      },
      { 
        id: 'subtitle', 
        type: 'subtitle', 
        font: fontFamily, 
        size: subtitleSize, 
        weight: 500, 
        color: '#FFFFFF',
        position: { x: width / 2, y: subtitleY }, 
        maxWidth: Math.round(width * 0.75), 
        maxLines: 3, 
        align: 'center' 
      },
      { 
        id: 'punchline', 
        type: 'subtitle', 
        font: fontFamily, 
        size: bodySize, 
        weight: 400, 
        color: '#FFFFFF',
        position: { x: width / 2, y: bodyY }, 
        maxWidth: Math.round(width * 0.70), 
        maxLines: 5, 
        align: 'center' 
      }
    ],
    logoZone: { 
      x: width - 140, 
      y: height - 100, 
      width: 100, 
      height: 60 
    }
  };
  
  return template;
}

/**
 * Upload SVG to Cloudinary using the official cloudinary Edge Function
 * ✅ FIX: Utilise supabase.functions.invoke au lieu de signature manuelle
 */
async function uploadSvgToCloudinary(
  svgContent: string, 
  folder: string, 
  publicId: string,
  supabaseAdmin: any // ✅ Type générique pour éviter les erreurs de typage
): Promise<{ public_id: string; secure_url: string }> {
  // ✅ Convertir SVG en base64 data URL
  const svgBase64 = btoa(unescape(encodeURIComponent(svgContent)));
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
  
  // ✅ Utiliser l'Edge Function cloudinary qui gère la signature correctement
  const { data: uploadData, error: uploadErr } = await supabaseAdmin.functions.invoke("cloudinary", {
    body: {
      action: "upload",
      params: {
        file: dataUrl,
        folder: folder,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
        tags: ["svg_overlay", "carousel", "premium"],
      },
    },
  });
  
  if (uploadErr || !uploadData) {
    console.error('[uploadSvgToCloudinary] ❌ Upload failed:', uploadErr);
    throw new Error(`SVG upload failed: ${uploadErr?.message || 'Unknown error'}`);
  }
  
  return {
    public_id: uploadData.public_id,
    secure_url: uploadData.secure_url,
  };
}

/**
 * Composite background image with SVG overlay using Cloudinary
 */
function buildCompositeUrl(
  backgroundPublicId: string,
  svgPublicId: string,
  cloudName: string
): string {
  // ✅ Cloudinary URL avec overlay SVG sur le fond
  // fl_layer_apply applique le SVG par-dessus le background
  return `https://res.cloudinary.com/${cloudName}/image/upload/l_${svgPublicId.replace(/\//g, ':')},fl_layer_apply/${backgroundPublicId}`;
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, ms = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetries(url: string, init: RequestInit, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    const res = await fetchWithTimeout(url, init, 30000);
    if (res.ok) return res;

    const body = await res.text().catch(() => "");
    const is429 = res.status === 429;
    const is5xx = res.status >= 500 && res.status <= 599;

    if ((is429 || is5xx) && attempt < maxRetries) {
      const wait = Math.round(Math.pow(1.8, attempt + 1) * 800); // 1.44s, 2.59s
      console.warn(`[render-slide] ⏳ retry ${attempt + 1}/${maxRetries} after ${wait}ms (status=${res.status})`);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
      continue;
    }
    // propagate last response (non ok)
    return new Response(body, { status: res.status, headers: res.headers });
  }
}

/**
 * ✅ Valide qu'une image base64 n'est pas blanche/vide
 * Vérifie les premiers pixels pour détecter une image entièrement blanche
 */
function isWhiteImage(base64Data: string): boolean {
  try {
    // Retirer le préfixe data:image/...;base64, si présent
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    // Décoder quelques octets pour vérifier
    const binaryString = atob(cleanBase64.slice(0, 1000)); // Premiers 750 bytes environ
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Pour un PNG, les données pixels commencent après le header
    // Compter combien d'octets sont >= 250 (presque blanc)
    let whiteCount = 0;
    let totalChecked = 0;
    for (let i = 50; i < bytes.length && totalChecked < 500; i++) {
      if (bytes[i] >= 250) whiteCount++;
      totalChecked++;
    }
    
    // Si plus de 90% des bytes vérifiés sont "blancs", image probablement blanche
    const whiteRatio = whiteCount / totalChecked;
    console.log(`[render-slide] Image validation: ${(whiteRatio * 100).toFixed(1)}% white pixels detected`);
    return whiteRatio > 0.90;
  } catch (e) {
    console.warn("[render-slide] Could not validate image, assuming OK:", e);
    return false;
  }
}

/**
 * ✅ Prompt de secours ultra-simple pour forcer des couleurs
 */
function buildEmergencyColorPrompt(theme: string): string {
  return `Create a colorful abstract background.
Use bright colors: purple and blue gradient with glowing pink orbs.
Theme hint: ${theme || "modern professional"}.
NO WHITE. NO TEXT. Rich saturated colors only.`;
}

// -----------------------------
// Handler
// -----------------------------
Deno.serve(async (req) => {
  console.log("[alfie-render-carousel-slide] v2.5.0 — invoked");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ✅ Validate internal secret FIRST
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== INTERNAL_FN_SECRET) {
    console.error("[alfie-render-carousel-slide] ❌ Invalid or missing internal secret");
    return json({ error: "Forbidden: invalid internal secret" }, 403);
  }

  // ✅ ENV validation using imported variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LOVABLE_API_KEY) {
    console.error("[alfie-render-carousel-slide] ❌ Missing critical env vars");
    return json({ error: "Missing required environment variables" }, 500);
  }

  try {
    const params = (await req.json()) as SlideRequest;
    let {
      userId,
      prompt,
      globalStyle,
      slideContent,
      brandId,
      orderId,
      orderItemId,
      carouselId,
      slideIndex,
      totalSlides,
      aspectRatio,
      textVersion,
      renderVersion,
      campaign,
      language = "FR",
      requestId = null,
      useBrandKit = true, // ✅ Par défaut : utiliser le Brand Kit
      carouselMode = 'standard', // ✅ Par défaut : Standard (overlay Cloudinary)
      carouselType = 'content', // ✅ Par défaut : Content (conseils/astuces)
      brandKit, // ✅ NOUVEAU: Brand Kit V2 complet
      referenceImageUrl, // ✅ NOUVEAU: Image de référence pour le style
      colorMode = 'vibrant', // ✅ NOUVEAU: Mode couleurs (vibrant/pastel)
      visualStyle = 'background', // ✅ NOUVEAU: Style visuel (background/character/product)
    } = params;
    
    // ✅ Sélectionner le modèle selon le mode
    const MODEL_IMAGE = carouselMode === 'premium' ? MODEL_IMAGE_PREMIUM : MODEL_IMAGE_STANDARD;
    console.log(`[render-slide] 🎨 Mode: ${carouselMode} - Model: ${MODEL_IMAGE} - Visual: ${visualStyle}`);

    // —— Supabase admin client (service role)
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // —— Validations d'entrée minimales
    const missing: string[] = [];
    if (!prompt) missing.push("prompt");
    if (!globalStyle) missing.push("globalStyle");
    if (!slideContent?.title) missing.push("slideContent.title");
    if (!slideContent?.alt) missing.push("slideContent.alt");
    if (!brandId) missing.push("brandId");
    if (!orderId) missing.push("orderId");
    if (!carouselId) missing.push("carouselId");

    if (!Number.isInteger(slideIndex) || slideIndex < 0) {
      missing.push("slideIndex(non-negative integer)");
    }
    if (!Number.isInteger(totalSlides) || totalSlides <= 0) {
      missing.push("totalSlides(positive integer)");
    }
    if (Number.isInteger(slideIndex) && Number.isInteger(totalSlides) && slideIndex >= totalSlides) {
      missing.push(`slideIndex(${slideIndex}) < totalSlides(${totalSlides})`);
    }

    if (missing.length) {
      return json({ error: `Missing/invalid fields: ${missing.join(", ")}` }, 400);
    }

    // —— userId: déduction depuis orderId si absent
    if (!userId) {
      console.log(`[render-slide] ⚠️ Missing userId, deducing from orderId=${orderId}`);
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("user_id")
        .eq("id", orderId)
        .single();

      if (orderErr || !order?.user_id) {
        console.error("[render-slide] ❌ Cannot deduce userId:", orderErr);
        return json({ error: "userId is required and could not be deduced from orderId" }, 400);
      }
      userId = order.user_id;
      console.log(`[render-slide] ✅ Deduced userId=${userId}`);
    }

    const lang = normalizeLang(language);
    const { ar: normalizedAR, size } = normalizeAspectRatio(aspectRatio);

    const logCtx = `order=${orderId} car=${carouselId} slide=${slideIndex + 1}/${totalSlides}`;
    console.log(`[render-slide] ${logCtx} context`, {
      userId,
      ar: normalizedAR,
      size,
      lang,
    });

    // ------------------------------------------
    // Normalize textual content + soft limits
    // ------------------------------------------
    const MAX_TITLE = 35; // ✅ Réduit pour éviter troncature visuelle
    const MAX_SUB   = 70;  // ✅ Aligné avec frontend CHAR_LIMITS
    const MAX_BUL   = 4;
    const MAX_BUL_LEN = 60;

    const MAX_BODY = 150; // ✅ Ajout limite body
    
    const normTitle = String(slideContent.title || "").trim().slice(0, MAX_TITLE);
    const normSubtitle = String(slideContent.subtitle || "").trim().slice(0, MAX_SUB);
    const normBody = String(slideContent.body || "").trim().slice(0, MAX_BODY); // ✅ Extraire le body
    const normBullets = (Array.isArray(slideContent.bullets) ? slideContent.bullets : [])
      .map(b => String(b || "").trim())
      .filter(b => b.length > 0)
      .slice(0, MAX_BUL)
      .map(b => b.slice(0, MAX_BUL_LEN));

    if (!normTitle) {
      return json({ error: "slideContent.title cannot be empty after normalization" }, 400);
    }
    if (!slideContent.alt || !String(slideContent.alt).trim()) {
      return json({ error: "slideContent.alt is required" }, 400);
    }

    // =========================================
    // STEP 1/4 — Upload texte JSON (RAW)
    // =========================================
    console.log(`[render-slide] ${logCtx} 1/4 Upload text JSON → Cloudinary RAW`);
    const textPublicId = await uploadTextAsRaw(
      {
        title: normTitle,
        subtitle: normSubtitle,
        bullets: normBullets,
        alt: slideContent.alt,
      },
      {
        brandId,
        campaign,
        carouselId,
        textVersion,
        language: lang,
      }
    );
    console.log(`[render-slide] ${logCtx}   ↳ text_public_id: ${textPublicId}`);

    // =========================================
    // STEP 2/4 — Générer background (Vertex AI Gemini priorité)
    // =========================================
    
    // ✅ V9: Route le prompt selon visualStyle (background/character/product)
    let enrichedPrompt: string;
    
    // ✅ V10: Détecter si avatar disponible pour mode character
    const hasAvatarForCharacter = visualStyle === 'character' && !!brandKit?.avatar_url;
    
    // ✅ Déterminer si on génère avec texte intégré (standard) ou fond seul (background_only)
    const isBackgroundOnly = carouselMode === 'background_only';
    const hasValidText = normTitle && normTitle !== "Titre par défaut" && normTitle.trim().length > 0;
    
    if (visualStyle === 'character') {
      // ✅ Mode PERSONNAGE: génère un avatar/personnage 3D
      enrichedPrompt = buildImagePromptCharacter(
        prompt,
        brandKit,
        useBrandKit,
        slideIndex,
        totalSlides,
        colorMode as ColorMode,
        hasAvatarForCharacter // ✅ V10: Indique si référence avatar fournie
      );
      console.log(`[render-slide] ${logCtx} 🧑 Using CHARACTER prompt (hasAvatar: ${hasAvatarForCharacter})`);
    } else if (visualStyle === 'product') {
      // ✅ Mode PRODUIT: mise en scène du produit uploadé
      enrichedPrompt = buildImagePromptProduct(
        prompt,
        brandKit,
        useBrandKit,
        referenceImageUrl,
        slideIndex,
        totalSlides,
        colorMode as ColorMode
      );
      console.log(`[render-slide] ${logCtx} 📦 Using PRODUCT prompt (hasRef: ${!!referenceImageUrl})`);
    } else if (!isBackgroundOnly && hasValidText) {
      // ✅ NEW: Mode STANDARD COMPLET avec texte intégré par Nano Banana Pro
      enrichedPrompt = buildImagePromptWithText(
        globalStyle,
        prompt,
        { 
          title: normTitle, 
          subtitle: normSubtitle, 
          body: normBody,
          bullets: normBullets 
        },
        slideIndex,
        totalSlides,
        brandKit,
        colorMode as ColorMode
      );
      console.log(`[render-slide] ${logCtx} 📝 Using TEXT-INTEGRATED prompt (complete carousel)`);
    } else {
      // ✅ Mode BACKGROUND ONLY (fond seul, pas de texte) - pour ajout texte manuel
      enrichedPrompt = carouselMode === 'premium'
        ? buildImagePromptPremium(
            prompt,
            brandKit,
            useBrandKit,
            slideIndex,
            totalSlides,
            referenceImageUrl,
            colorMode as ColorMode
          )
        : buildImagePromptStandard(
            globalStyle, 
            prompt, 
            useBrandKit,
            { title: normTitle, subtitle: normSubtitle, alt: slideContent.alt },
            slideIndex,
            totalSlides,
            brandKit,
            colorMode as ColorMode
          );
      console.log(`[render-slide] ${logCtx} 🎨 Using BACKGROUND-ONLY prompt (mode: ${carouselMode})`);
    }
    
    console.log(`[render-slide] ${logCtx} 🎨 Mode: ${carouselMode}, Visual: ${visualStyle}, isBackgroundOnly: ${isBackgroundOnly}, hasValidText: ${hasValidText}, hasRef: ${!!referenceImageUrl}`);

    let bgUrl: string | null = null;
    let imageAttempt = 0;
    const maxImageAttempts = 2;

    // ✅ LOVABLE AI avec validation anti-images blanches et retry
    while (imageAttempt < maxImageAttempts && !bgUrl) {
      // ✅ FIX: Forcer le modèle PREMIUM quand texte intégré est requis
      // Le modèle standard (gemini-2.5-flash) est faible pour le rendu de texte
      // Le modèle premium (gemini-3-pro-image-preview) gère bien le texte intégré
      const integratedTextRequested = !isBackgroundOnly && hasValidText;
      const selectedModel = integratedTextRequested 
        ? MODEL_IMAGE_PREMIUM  // ✅ Forcer Premium pour texte intégré
        : (carouselMode === 'premium' ? MODEL_IMAGE_PREMIUM : MODEL_IMAGE_STANDARD);
      
      if (integratedTextRequested) {
        console.log(`[render-slide] ${logCtx} ✅ integratedTextRequested=true → forcing MODEL_IMAGE_PREMIUM (${MODEL_IMAGE_PREMIUM})`);
      }
      
      // ✅ Utiliser prompt de secours si première tentative a échoué
      const currentPrompt = imageAttempt === 0 
        ? enrichedPrompt 
        : buildEmergencyColorPrompt(prompt);
      
      console.log(`[render-slide] ${logCtx} 2/4 Attempt ${imageAttempt + 1}/${maxImageAttempts} with Lovable AI (${selectedModel})...`);
      
      // ✅ V10: Construire le message utilisateur avec image de référence si avatar disponible en mode character
      let userMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      
      if (hasAvatarForCharacter && brandKit?.avatar_url) {
        // ✅ Message multimodal avec avatar comme référence
        userMessageContent = [
          { type: "text", text: currentPrompt },
          { type: "image_url", image_url: { url: brandKit.avatar_url } }
        ];
        console.log(`[render-slide] ${logCtx}   ↳ Including avatar reference: ${brandKit.avatar_url.slice(0, 80)}...`);
      } else if (visualStyle === 'product' && referenceImageUrl) {
        // ✅ Mode produit avec image de référence
        userMessageContent = [
          { type: "text", text: currentPrompt },
          { type: "image_url", image_url: { url: referenceImageUrl } }
        ];
        console.log(`[render-slide] ${logCtx}   ↳ Including product reference: ${referenceImageUrl.slice(0, 80)}...`);
      } else {
        // ✅ Texte simple
        userMessageContent = currentPrompt;
      }
      
      const aiRes = await fetchWithRetries(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { 
                role: "system", 
                content: isBackgroundOnly
                  ? `You are an expert image generator for social media.
CRITICAL: Generate a VIBRANT, COLORFUL background image - NOT white, NOT blank.
NO TEXT whatsoever - this is a pure background image for user to add their own text.
Output dimensions: ${size.w}x${size.h}.
${hasAvatarForCharacter ? "IMPORTANT: Reproduce the EXACT character from the reference image provided. Same style, colors, proportions." : ""}`
                  : `You are an expert image generator for social media carousel slides.
CRITICAL: Generate the image WITH the text integrated and perfectly CENTERED.
- Title: Large, bold, WHITE text with soft black shadow for readability
- Subtitle/Body: Smaller, WHITE text below title
- All text MUST be centered horizontally and vertically
- Background: Colorful gradients, NOT white
- Text must be the MAIN FOCUS and clearly legible
Output dimensions: ${size.w}x${size.h}.
${hasAvatarForCharacter ? "IMPORTANT: Reproduce the EXACT character from the reference image provided. Same style, colors, proportions." : ""}`
              },
              { role: "user", content: userMessageContent }
            ],
            modalities: ["image", "text"],
            size_hint: { width: size.w, height: size.h },
          }),
        },
        2
      );

      if (aiRes.status === 429) {
        console.error(`[render-slide] ${logCtx} ⏱️ Rate limit (429) after retries`);
        return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
      }
      if (aiRes.status === 402) {
        console.error(`[render-slide] ${logCtx} 💳 Insufficient credits (402)`);
        return json({ error: "Insufficient credits for AI generation" }, 402);
      }
      if (!aiRes.ok) {
        const errTxt = await aiRes.text().catch(() => "");
        console.error(`[render-slide] ${logCtx} ❌ AI error:`, aiRes.status, errTxt.slice(0, 600));
        imageAttempt++;
        continue;
      }

      const aiData = await aiRes.json().catch(() => ({}));
      const candidateUrl =
        aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
        aiData?.choices?.[0]?.message?.content?.[0]?.image_url?.url ||
        aiData?.choices?.[0]?.message?.image_url?.url ||
        aiData?.image_url?.url ||
        null;

      if (!candidateUrl) {
        console.warn(`[render-slide] ${logCtx} ⚠️ No image URL in response, retrying...`);
        imageAttempt++;
        continue;
      }

      // ✅ VALIDATION ANTI-IMAGE BLANCHE
      if (candidateUrl.startsWith('data:image')) {
        if (isWhiteImage(candidateUrl)) {
          console.warn(`[render-slide] ${logCtx} ⚠️ White/blank image detected, retrying with emergency prompt...`);
          imageAttempt++;
          continue;
        }
      }
      
      bgUrl = candidateUrl;
      console.log(`[render-slide] ${logCtx}   ↳ background_url: ${String(bgUrl).slice(0, 120)}`);
    }

    if (!bgUrl) {
      console.error(`[render-slide] ${logCtx} ❌ No valid colorful image after ${maxImageAttempts} attempts`);
      return json({ error: "AI failed to generate a colorful image after multiple attempts" }, 500);
    }

    // =========================================
    // STEP 3/4 — Upload image → Cloudinary (edge)
    // =========================================
    console.log(`[render-slide] ${logCtx} 3/4 Upload background → Cloudinary`);
    const slidePublicId = `slide_${String(slideIndex + 1).padStart(2, "0")}`;
    const slideFolder = `alfie/${brandId}/${carouselId}/slides`;

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.functions.invoke("cloudinary", {
      body: {
        action: "upload",
        params: {
          file: bgUrl,
          folder: slideFolder,
          public_id: slidePublicId,
          resource_type: "image",
          overwrite: true, // idempotence sur le même slide_public_id
          tags: [brandId, carouselId, "carousel_slide", campaign, "alfie"],
          context: {
            brand: brandId,
            carousel: carouselId,
            campaign: campaign,
            slide_index: String(slideIndex),
            render_version: String(renderVersion),
            text_version: String(textVersion),
            aspect_ratio: normalizedAR,
            size_hint: `${size.w}x${size.h}`,
          },
        },
      },
    });

    if (uploadErr || !uploadData) {
      console.error(`[render-slide] ${logCtx} ❌ Cloudinary upload error:`, uploadErr);
      return json({ error: `Failed to upload to Cloudinary: ${uploadErr?.message || "Unknown error"}` }, 502);
    }

    const cloudinarySecureUrl: string = uploadData.secure_url;
    const cloudinaryPublicId: string = uploadData.public_id;
    const uploadMeta = {
      width: uploadData.width,
      height: uploadData.height,
      format: uploadData.format,
    };

    console.log(`[render-slide] ${logCtx}   ↳ uploaded:`, {
      publicId: cloudinaryPublicId,
      url: cloudinarySecureUrl?.slice(0, 120),
      ...uploadMeta,
    });

    // =========================================
    // STEP 3.5 — Apply text overlay (BOTH modes now use Cloudinary overlay)
    // =========================================
    let finalUrl = cloudinarySecureUrl;
    
    // ✅ V8: Debug raw brandKit data
    console.log(`[render-slide] ${logCtx} Raw brandKit:`, JSON.stringify({
      palette: brandKit?.palette,
      fonts: brandKit?.fonts,
      name: brandKit?.name
    }));
    
    // ✅ V8: Extract Brand Kit fonts and colors for overlay
    const brandFonts: BrandFonts = {
      primary: brandKit?.fonts?.primary || 'Inter',
      secondary: brandKit?.fonts?.secondary || 'Inter'
    };
    
    // ✅ V8: Extract primary color from Brand Kit palette with contrast fallback
    const brandPrimaryColor = (() => {
      const raw = brandKit?.palette?.[0]?.replace('#', '') || '';
      if (!raw || raw === 'ffffff' || raw === 'fff') return '222222'; // Fallback noir
      // Vérifier si couleur très claire (R+G+B > 650)
      const r = parseInt(raw.slice(0, 2), 16) || 0;
      const g = parseInt(raw.slice(2, 4), 16) || 0;
      const b = parseInt(raw.slice(4, 6), 16) || 0;
      if (r + g + b > 650) return '333333'; // Trop clair, utiliser gris foncé
      return raw;
    })();
    const brandSecondaryColor = brandKit?.palette?.[1]?.replace('#', '') || 'cccccc';
    // ✅ V9: Couleur de texte du Brand Kit avec fallback blanc
    const brandTextColor = (brandKit as any)?.text_color?.replace('#', '') || 'ffffff';
    
    // ✅ STEP 3.5 — Conditional text overlay
    // - Mode STANDARD (avec texte intégré par IA): PAS d'overlay Cloudinary
    // - Mode BACKGROUND_ONLY: PAS d'overlay (l'utilisateur ajoute son texte manuellement)
    
    if (isBackgroundOnly) {
      // ✅ Mode BACKGROUND_ONLY: pas d'overlay, l'utilisateur ajoute son texte
      console.log(`[render-slide] ${logCtx} 3.5/4 Background-only mode: NO text overlay (user adds text manually)`);
      // finalUrl reste cloudinarySecureUrl
    } else if (hasValidText) {
      // ✅ Mode STANDARD COMPLET: texte déjà intégré par l'IA, pas besoin d'overlay Cloudinary
      console.log(`[render-slide] ${logCtx} 3.5/4 Complete carousel mode: text already integrated by AI (Nano Banana Pro)`);
      // finalUrl reste cloudinarySecureUrl (l'image contient déjà le texte)
    } else {
      // ✅ Fallback: appliquer overlay Cloudinary si nécessaire (ancienne logique)
      console.log(`[render-slide] ${logCtx} 3.5/4 Fallback: Applying Cloudinary text overlay`);
      console.log(`[render-slide] ${logCtx}   ↳ Brand fonts: primary="${brandFonts.primary}", secondary="${brandFonts.secondary}"`);
      console.log(`[render-slide] ${logCtx}   ↳ Brand colors: primary=#${brandPrimaryColor}, secondary=#${brandSecondaryColor}, text=#${brandTextColor}`);
      
      // Déterminer le type de slide pour l'overlay
      const slideType = slideIndex === 0 ? 'hero' 
        : slideIndex === totalSlides - 1 ? 'cta'
        : slideIndex === 1 ? 'problem'
        : slideIndex === totalSlides - 2 ? 'solution'
        : 'impact';
      
      // ✅ Pour CITATIONS: forcer subtitle/bullets/body à vide, même si passés
      const slideData: Slide = {
        type: slideType,
        title: normTitle,
        subtitle: carouselType === 'citations' ? undefined : (normSubtitle || undefined),
        punchline: carouselType === 'citations' ? undefined : (normBody || undefined),
        bullets: carouselType === 'citations' ? undefined : (normBullets.length > 0 ? normBullets : undefined),
        cta: slideType === 'cta' ? normTitle : undefined,
        author: slideContent.author || undefined,
      };
      
      try {
        // ✅ V9: Apply overlay with Brand Kit fonts, colors AND text color
        finalUrl = buildCarouselSlideUrl(
          cloudinaryPublicId,
          slideData,
          brandPrimaryColor,
          brandSecondaryColor,
          carouselType,
          brandFonts,
          brandTextColor
        );
        console.log(`[render-slide] ${logCtx}   ↳ overlay URL: ${finalUrl?.slice(0, 150)}...`);
      } catch (overlayErr) {
        console.warn(`[render-slide] ${logCtx} ⚠️ Overlay failed, using base image:`, overlayErr);
        finalUrl = cloudinarySecureUrl;
      }
    }

    // =========================================
    // STEP 4/4 — Upsert DB (idempotent)
    // =========================================
    console.log(`[render-slide] ${logCtx} 4/4 Save to library_assets (idempotence check)`);
    const existingQuery = supabaseAdmin
      .from("library_assets")
      .select("id, cloudinary_url, cloudinary_public_id")
      .eq("order_id", orderId)
      .eq("carousel_id", carouselId)
      .eq("slide_index", slideIndex);

    if (orderItemId) {
      existingQuery.eq("order_item_id", orderItemId);
    } else {
      existingQuery.is("order_item_id", null);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      console.log(`[render-slide] ${logCtx} ♻️ Asset already exists: ${existing.id}`);
      return json({
        success: true,
        idempotent: true,
        cloudinary_url: existing.cloudinary_url,
        cloudinary_public_id: existing.cloudinary_public_id,
        text_public_id: textPublicId,
        slide_metadata: {
          title: normTitle,
          subtitle: normSubtitle,
          bullets: normBullets,
          slideIndex,
          renderVersion,
          textVersion,
          aspectRatio: normalizedAR,
          carouselMode,
        },
      });
    }

    // ✅ CORRECTION: Sauvegarder l'URL de BASE (sans overlays) dans cloudinary_url
    // Les images doivent être téléchargeables sans problème de fonts Cloudinary
    const { error: insertErr } = await supabaseAdmin.from("library_assets").insert({
      user_id: userId,
      brand_id: brandId,
      order_id: orderId,
      order_item_id: orderItemId ?? null,
      carousel_id: carouselId,
      type: "carousel_slide",
      slide_index: slideIndex,
      format: normalizedAR,
      campaign,
      cloudinary_url: cloudinarySecureUrl,  // ✅ CORRECTION: URL de BASE (sans overlay)
      cloudinary_public_id: cloudinaryPublicId,
      text_json: {
        title: normTitle,
        subtitle: normSubtitle,
        body: slideContent.body || '',
        bullets: normBullets,
        alt: slideContent.alt,
        text_public_id: textPublicId,
        text_version: textVersion,
        render_version: renderVersion,
        carousel_mode: carouselMode,
      },
      metadata: {
        ...uploadMeta,
        cloudinary_base_url: cloudinarySecureUrl,   // ✅ URL de base (sans overlay)
        cloudinary_overlay_url: finalUrl,           // ✅ URL avec overlay (pour référence)
        original_public_id: cloudinaryPublicId,
        totalSlides,
        aspectRatio: normalizedAR,
        size_hint: `${size.w}x${size.h}`,
        orderItemId: orderItemId ?? null,
        requestId,
        carouselMode,
      },
    });

    if (insertErr) {
      console.error(`[render-slide] ${logCtx} ❌ DB insert error:`, insertErr);
      return json({ error: `Failed to save slide: ${insertErr.message}` }, 500);
    }

    console.log(`[render-slide] ${logCtx} ✅ Slide saved (mode: ${carouselMode})`);
    return json({
      success: true,
      cloudinary_url: finalUrl,           // ✅ URL finale
      cloudinary_base_url: cloudinarySecureUrl, // ✅ URL de base
      cloudinary_public_id: cloudinaryPublicId,
      text_public_id: textPublicId,
      carousel_mode: carouselMode,
      slide_metadata: {
        title: normTitle,
        subtitle: normSubtitle,
        bullets: normBullets,
        slideIndex,
        totalSlides,
        renderVersion,
        textVersion,
        aspectRatio: normalizedAR,
        carouselMode,
      },
    });
  } catch (err: any) {
    console.error("[alfie-render-carousel-slide] 💥 Error:", err);
    return json(
      {
        error: err?.message || "Unknown error",
        details: err?.stack,
      },
      500
    );
  }
});
