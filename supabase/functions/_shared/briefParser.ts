// supabase/functions/_shared/briefParser.ts
// v2.0.0 — Parse user briefs generically with positive/negative instructions + raw capture

/**
 * Parsed brief structure for carousel generation
 * Extracts user-provided texts, constraints, and style instructions
 */
export interface ParsedBrief {
  /** If true, user provided structured slide texts - use them directly */
  hasStructuredSlides: boolean;
  
  /** Global style instructions (applied to all slides) */
  globalStyle: {
    colorMode?: 'pastel' | 'vibrant' | 'neutral';
    backgroundStyle?: string;      // e.g., "liquid gradient minimal"
    typographyStyle?: string;      // e.g., "3D bubble glossy"
    textContainer?: string;        // e.g., "frosted glass rectangle"
  };
  
  /** Per-slide texts and constraints */
  slides: ParsedSlide[];
  
  /** Global constraints (applied to all slides) */
  globalConstraints: string[];
  
  /** ✅ NEW: Raw brief instructions for AI (freeform text not captured by patterns) */
  rawBriefInstructions: string;
  
  /** ✅ NEW: Positive instructions (e.g., "with mascot", "human characters") */
  positiveInstructions: string[];
}

export interface ParsedSlide {
  index: number;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  cta?: string;
  
  /** Per-slide constraints (e.g., "no character", "typography only") */
  constraints: string[];
  
  /** Whether mascot/character is allowed on this slide */
  allowMascot: boolean;
  
  /** ✅ NEW: Visual prompt for this slide (from brief) */
  visualPrompt?: string;
}

/**
 * Patterns to detect structured slide content in user prompts
 */
const SLIDE_PATTERNS = [
  // "Slide 1: Title" or "Slide 1 (avec Alfie) : Title"
  /slide\s*(\d+)\s*(?:\([^)]*\))?\s*:\s*["']?(.+?)["']?(?:\n|$)/gi,
  // "1. Title" or "1) Title"
  /^\s*(\d+)[.)]\s*(.+?)(?:\n|$)/gim,
  // "Slide N (constraint): Title"
  /slide\s*(\d+)\s*\(([^)]+)\)\s*:\s*["']?(.+?)["']?(?:\n|$)/gi,
];

const SUBTITLE_PATTERN = /sous-texte\s*:\s*["']?(.+?)["']?(?:\n|$)/gi;
const CTA_PATTERN = /(?:cta|bouton)\s*:\s*["']?(.+?)["']?(?:\n|$)/gi;

/**
 * ✅ Constraint keywords to detect (NEGATIVE instructions)
 */
const CONSTRAINT_KEYWORDS: Record<string, string[]> = {
  noCharacter: ['sans personnage', 'no character', 'sans mascotte', 'no mascot', 'sans avatar', 'aucun personnage', 'aucune mascotte', 'without character', 'sans alfie'],
  noAnimal: ['sans animal', 'no animal', 'aucun animal'],
  noObject: ['sans objet', 'no object', 'aucun objet'],
  typographyOnly: ['typo seule', 'typography only', 'texte seul', 'text only', 'typo + fond', 'typography + background', 'fond seulement', 'background only'],
  noUI: ['sans écran', 'no screen', 'sans ui', 'no ui', 'sans dashboard', 'no dashboard', 'sans hologramme', 'no hologram'],
  noTech: ['sans tech', 'no tech', 'aucun élément tech', 'no tech elements', 'décor interdit'],
  noStars: ['sans étoiles', 'no stars', 'sans particules', 'no particles', 'sans galaxie', 'no galaxy'],
  noIcons: ['sans icône', 'no icons', 'aucune icône'],
  backgroundOnly: ['fond seul', 'background only', 'fond uniquement'],
};

/**
 * ✅ NEW: Positive keywords to detect (AFFIRMATIVE instructions)
 */
const POSITIVE_KEYWORDS: Record<string, string[]> = {
  withMascot: ['avec mascotte', 'with mascot', 'mascotte sur', 'alfie sur', 'avec alfie', 'alfie autorisé', 'mascot allowed'],
  withCharacter: ['avec personnage', 'with character', 'personnages humains', 'human characters', 'personnage humain', 'real person'],
  withAvatar: ['avec avatar', 'with avatar', 'avatar 3d', '3d avatar'],
  withProduct: ['avec produit', 'with product', 'produit central', 'product focus'],
  styleWatercolor: ['watercolor', 'aquarelle'],
  style3DBubble: ['3d bubble', 'bubble glossy', 'lettres gonflées', 'lettres 3d'],
  styleFrostedGlass: ['verre dépoli', 'frosted glass', 'glass morphism', 'blur léger'],
  stylePixar: ['pixar', 'disney', 'style pixar', 'pixar style'],
  stylePhoto: ['photorealistic', 'photo réaliste', 'photographie', 'photography'],
  styleMinimal: ['minimal', 'minimaliste', 'minimalist', 'beaucoup d\'air', 'lots of whitespace'],
};

/**
 * Style keywords to detect
 */
const STYLE_KEYWORDS: Record<string, string[]> = {
  pastel: ['pastel', 'doux', 'soft', 'muted', 'gentle', 'mint', 'lavande', 'rose pâle'],
  neutral: ['neutre', 'neutral', 'minimal', 'minimaliste', 'noir et blanc', 'black and white'],
  vibrant: ['vibrant', 'vif', 'coloré', 'saturé', 'colorful'],
};

/**
 * Parse a user brief to extract structured content
 */
export function parseBrief(rawBrief: string, slideCount: number = 5): ParsedBrief {
  const brief = rawBrief.trim();
  const lowerBrief = brief.toLowerCase();
  
  // 1. Detect global constraints (negative)
  const globalConstraints = detectConstraints(lowerBrief);
  
  // 2. ✅ NEW: Detect positive instructions
  const positiveInstructions = detectPositiveInstructions(lowerBrief);
  
  // 3. Detect global style
  const globalStyle = detectGlobalStyle(lowerBrief);
  
  // 4. Try to extract structured slides
  const extractedSlides = extractSlides(brief, slideCount);
  const hasStructuredSlides = extractedSlides.length > 0 && extractedSlides.some(s => s.title.trim().length > 0);
  
  // 5. If no structured slides, return empty slides
  const slides: ParsedSlide[] = hasStructuredSlides 
    ? extractedSlides
    : Array.from({ length: slideCount }, (_, i) => ({
        index: i,
        title: '',
        constraints: [],
        allowMascot: true,
      }));
  
  // 6. Apply slide-specific constraints from brief
  applySlideConstraints(slides, brief);
  
  // 7. ✅ NEW: Extract raw freeform instructions (everything not matched by patterns)
  const rawBriefInstructions = extractFreeformInstructions(brief);
  
  return {
    hasStructuredSlides,
    globalStyle,
    slides,
    globalConstraints,
    rawBriefInstructions,
    positiveInstructions,
  };
}

/**
 * Detect constraints from text
 */
function detectConstraints(text: string): string[] {
  const constraints: string[] = [];
  
  for (const [key, keywords] of Object.entries(CONSTRAINT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      constraints.push(key);
    }
  }
  
  return constraints;
}

/**
 * ✅ NEW: Detect positive instructions from text
 */
function detectPositiveInstructions(text: string): string[] {
  const positive: string[] = [];
  
  for (const [key, keywords] of Object.entries(POSITIVE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      positive.push(key);
    }
  }
  
  return positive;
}

/**
 * ✅ NEW: Extract freeform instructions not captured by patterns
 * This captures style descriptions, font names, custom requirements, etc.
 */
function extractFreeformInstructions(brief: string): string {
  // Capture specific style instructions that should be passed to AI
  const instructionPatterns = [
    /police\s*[:\s]+([^\n.]+)/gi,           // Font: Baloon
    /typo(?:graphie)?\s*[:\s]+([^\n.]+)/gi, // Typo: 3D bubble
    /style\s*[:\s]+([^\n.]+)/gi,            // Style: liquid gradient
    /texte\s*[:\s]+([^\n.]+)/gi,            // Texte: blanc #F9FAFB
    /couleur[s]?\s*[:\s]+([^\n.]+)/gi,      // Couleurs: mint/rose
    /fond\s*[:\s]+([^\n.]+)/gi,             // Fond: uniquement
    /contraintes?\s*(?:strictes?)?\s*[:\s]+([^\n]+)/gi, // Contraintes: ...
    /cartouche\s*[:\s]+([^\n.]+)/gi,        // Cartouche: verre dépoli
  ];
  
  const parts: string[] = [];
  for (const pattern of instructionPatterns) {
    const matches = brief.matchAll(pattern);
    for (const match of matches) {
      if (match[1]?.trim()) {
        parts.push(match[1].trim());
      }
    }
  }
  
  return parts.join('. ');
}

/**
 * Detect global style from brief
 */
function detectGlobalStyle(text: string): ParsedBrief['globalStyle'] {
  const style: ParsedBrief['globalStyle'] = {};
  
  // Color mode detection
  if (STYLE_KEYWORDS.pastel.some(kw => text.includes(kw))) {
    style.colorMode = 'pastel';
  } else if (STYLE_KEYWORDS.neutral.some(kw => text.includes(kw))) {
    style.colorMode = 'neutral';
  } else if (STYLE_KEYWORDS.vibrant.some(kw => text.includes(kw))) {
    style.colorMode = 'vibrant';
  }
  
  // Background style detection
  const bgPatterns = [
    /(?:fond|background)\s*:\s*([^.\n]+)/i,
    /style\s*:\s*([^.\n]*gradient[^.\n]*)/i,
    /(?:liquid\s+)?gradient\s+(?:pastel\s+)?(?:minimal|minimaliste)/i,
  ];
  for (const pattern of bgPatterns) {
    const match = text.match(pattern);
    if (match) {
      style.backgroundStyle = match[1] || match[0];
      break;
    }
  }
  
  // Typography style detection
  const typoPatterns = [
    /typo(?:graphie)?\s*(?:obligatoire)?\s*:\s*([^.\n]+)/i,
    /(?:3d\s+)?bubble\s+glossy/i,
    /lettres\s+gonflées/i,
  ];
  for (const pattern of typoPatterns) {
    const match = text.match(pattern);
    if (match) {
      style.typographyStyle = match[1] || match[0];
      break;
    }
  }
  
  // Text container detection
  const containerPatterns = [
    /cartouche\s*(?:texte)?\s*:\s*([^.\n]+)/i,
    /verre\s+dépoli/i,
    /frosted\s+glass/i,
    /rectangle\s+arrondi/i,
  ];
  for (const pattern of containerPatterns) {
    const match = text.match(pattern);
    if (match) {
      style.textContainer = match[1] || match[0];
      break;
    }
  }
  
  return style;
}

/**
 * Extract structured slides from brief
 */
function extractSlides(text: string, slideCount: number): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  const lines = text.split('\n');
  
  let currentSlide: ParsedSlide | null = null;
  let inSlideBlock = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for slide header patterns
    // Pattern: "Slide N (constraints) : Title" or "Slide N : Title"
    const slideMatch = trimmedLine.match(/slide\s*(\d+)\s*(?:\(([^)]*)\))?\s*:\s*["']?(.+?)["']?$/i);
    
    if (slideMatch) {
      // Save previous slide
      if (currentSlide) {
        slides.push(currentSlide);
      }
      
      const slideIndex = parseInt(slideMatch[1], 10) - 1;
      const parenthetical = slideMatch[2] || '';
      const title = slideMatch[3].trim();
      
      // Detect constraints from parenthetical
      const constraints = detectConstraints(parenthetical.toLowerCase());
      const allowMascot = !constraints.includes('noCharacter') && 
                          !parenthetical.toLowerCase().includes('sans') &&
                          !parenthetical.toLowerCase().includes('without');
      
      currentSlide = {
        index: slideIndex,
        title: cleanText(title),
        constraints,
        allowMascot: parenthetical.toLowerCase().includes('avec') || 
                     parenthetical.toLowerCase().includes('with') ||
                     (!parenthetical && slideIndex === 0) || // First slide often has mascot
                     (!parenthetical && slideIndex === slideCount - 1), // Last slide often has mascot
      };
      inSlideBlock = true;
      continue;
    }
    
    // Check for subtitle pattern
    if (currentSlide && inSlideBlock) {
      const subtitleMatch = trimmedLine.match(/sous-texte\s*:\s*["']?(.+?)["']?$/i);
      if (subtitleMatch) {
        currentSlide.subtitle = cleanText(subtitleMatch[1]);
        continue;
      }
      
      // Check for CTA/button pattern
      const ctaMatch = trimmedLine.match(/(?:bouton|cta|button)\s*(?:pilule)?\s*(?:bas)?\s*:\s*["']?(.+?)["']?$/i);
      if (ctaMatch) {
        currentSlide.cta = cleanText(ctaMatch[1]);
        continue;
      }
    }
  }
  
  // Push last slide
  if (currentSlide) {
    slides.push(currentSlide);
  }
  
  // Sort by index and fill gaps
  slides.sort((a, b) => a.index - b.index);
  
  return slides;
}

/**
 * Apply slide-specific constraints based on brief patterns
 */
function applySlideConstraints(slides: ParsedSlide[], brief: string): void {
  const lowerBrief = brief.toLowerCase();
  
  // Pattern: "Slides 2-3-4 : CONSTRAINT"
  const rangeMatch = lowerBrief.match(/slides?\s+(\d+)[-–](\d+)[-–]?(\d+)?\s*:\s*([^.\n]+)/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10) - 1;
    const end = parseInt(rangeMatch[3] || rangeMatch[2], 10) - 1;
    const constraintText = rangeMatch[4];
    const constraints = detectConstraints(constraintText);
    
    for (let i = start; i <= end && i < slides.length; i++) {
      if (slides[i]) {
        slides[i].constraints.push(...constraints);
        if (constraints.includes('noCharacter') || constraintText.includes('sans') || constraintText.includes('aucun')) {
          slides[i].allowMascot = false;
        }
      }
    }
  }
  
  // Pattern: "Slides 1 et 5 : mascot allowed"
  const allowMatch = lowerBrief.match(/slides?\s+(\d+)\s+et\s+(\d+)\s*:\s*(?:alfie|mascotte?|personnage)\s+autorisé/i);
  if (allowMatch) {
    const idx1 = parseInt(allowMatch[1], 10) - 1;
    const idx2 = parseInt(allowMatch[2], 10) - 1;
    if (slides[idx1]) slides[idx1].allowMascot = true;
    if (slides[idx2]) slides[idx2].allowMascot = true;
  }
}

/**
 * Clean text: remove quotes, trim, handle line breaks
 */
function cleanText(text: string): string {
  return text
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n')
    .trim();
}

/**
 * Build constraint string for AI prompt
 */
export function buildConstraintPrompt(constraints: string[], allowMascot: boolean): string {
  const parts: string[] = [];
  
  if (!allowMascot || constraints.includes('noCharacter')) {
    parts.push('NO characters, NO mascots, NO avatars, NO people, NO animals');
  }
  if (constraints.includes('noObject')) {
    parts.push('NO objects, NO props');
  }
  if (constraints.includes('typographyOnly')) {
    parts.push('Typography and background ONLY');
  }
  if (constraints.includes('noUI')) {
    parts.push('NO screens, NO UI elements, NO dashboards, NO holograms');
  }
  if (constraints.includes('noTech')) {
    parts.push('NO tech elements, NO digital interfaces');
  }
  if (constraints.includes('noStars')) {
    parts.push('NO stars, NO particles, NO galaxy elements');
  }
  if (constraints.includes('noIcons')) {
    parts.push('NO icons, NO complex symbols');
  }
  if (constraints.includes('backgroundOnly')) {
    parts.push('Background scene ONLY');
  }
  
  return parts.length > 0 ? `STRICT CONSTRAINTS: ${parts.join('. ')}.` : '';
}

/**
 * Build style prompt from parsed global style
 */
export function buildStylePrompt(style: ParsedBrief['globalStyle']): string {
  const parts: string[] = [];
  
  if (style.colorMode === 'pastel') {
    parts.push('SOFT PASTEL colors: gentle, muted, delicate tones');
  } else if (style.colorMode === 'neutral') {
    parts.push('NEUTRAL palette: black, white, grays, minimal color');
  } else if (style.colorMode === 'vibrant') {
    parts.push('VIBRANT saturated colors with rich gradients');
  }
  
  if (style.backgroundStyle) {
    parts.push(`Background style: ${style.backgroundStyle}`);
  }
  
  if (style.typographyStyle) {
    parts.push(`Typography: ${style.typographyStyle}`);
  }
  
  if (style.textContainer) {
    parts.push(`Text container: ${style.textContainer}`);
  }
  
  return parts.join('. ');
}
