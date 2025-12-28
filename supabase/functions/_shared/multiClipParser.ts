// supabase/functions/_shared/multiClipParser.ts
// Parser pour prompts multi-clips vidéo ET multi-images

// ==================== MULTI-IMAGE PARSING ====================

export interface ParsedImage {
  imageNumber: number;
  visualPrompt: string;      // Instructions visuelles complètes
  textLines: string[];       // Textes à afficher (entre guillemets)
}

export interface MultiImageResult {
  isMultiImage: boolean;
  imageCount: number;
  globalStyle: string;       // Style commun (règles communes)
  images: ParsedImage[];
}

/**
 * Détecte si un prompt contient plusieurs sections "Image N :"
 */
export function isMultiImagePrompt(prompt: string): boolean {
  const imageMatches = prompt.match(/Image\s*\d+\s*:/gi);
  return imageMatches !== null && imageMatches.length >= 2;
}

/**
 * Parse un prompt multi-images et extrait chaque image avec ses specs
 */
export function parseMultiImagePrompt(prompt: string): MultiImageResult {
  // Résultat par défaut si pas multi-image
  if (!isMultiImagePrompt(prompt)) {
    return {
      isMultiImage: false,
      imageCount: 1,
      globalStyle: "",
      images: [{
        imageNumber: 1,
        visualPrompt: prompt,
        textLines: extractTextLines(prompt),
      }],
    };
  }

  // Extraire le style global (tout avant "Image 1 :")
  const beforeImagesMatch = prompt.match(/^([\s\S]*?)(?=Image\s*1\s*:)/i);
  const globalSection = beforeImagesMatch?.[1] || "";
  const globalStyle = globalSection.trim();

  // Diviser par "Image N :"
  const imageRegex = /Image\s*(\d+)\s*:\s*([\s\S]*?)(?=Image\s*\d+\s*:|$)/gi;
  const images: ParsedImage[] = [];
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(prompt)) !== null) {
    const imageNumber = parseInt(match[1], 10);
    const imageContent = match[2]?.trim() || "";

    // Extraire les lignes de texte (entre guillemets)
    const textLines = extractTextLines(imageContent);

    // Construire le prompt visuel complet
    // Inclure le style global + instructions spécifiques de l'image
    let visualPrompt = imageContent;
    
    // Ajouter instruction anti-hallucination
    visualPrompt += `\n\nCRITICAL: Display ONLY the text provided in quotes. NO additional text, NO labels like 'Catalogue', NO decorative words, NO extra typography.`;

    images.push({
      imageNumber,
      visualPrompt,
      textLines,
    });
  }

  console.log(`[multiClipParser] Parsed ${images.length} images:`, 
    images.map(i => ({ n: i.imageNumber, texts: i.textLines.length }))
  );

  return {
    isMultiImage: true,
    imageCount: images.length,
    globalStyle,
    images,
  };
}

// ==================== MULTI-CLIP VIDEO PARSING ====================

export interface ParsedClip {
  clipNumber: number;
  title: string;         // "HOOK", "CONTENU", "CTA", etc.
  keyframe: string;      // Instructions visuelles (fond, formes, éléments)
  textLines: string[];   // Lignes de texte à afficher (extrait des guillemets)
  animation: string;     // Instructions d'animation
  durationSec: number;   // Durée du clip (défaut: 8)
}

export interface MultiClipResult {
  isMultiClip: boolean;
  clipCount: number;
  globalStyle: string;   // Style global (palette, mode, ambiance)
  globalRules: string;   // Règles globales (interdit, text lock)
  clips: ParsedClip[];
}

/**
 * Détecte si un prompt contient des sections CLIP séparées
 */
export function isMultiClipPrompt(prompt: string): boolean {
  // Cherche le pattern "CLIP 1", "📹 CLIP 1", "CLIP 2", etc.
  const clipMatches = prompt.match(/(?:📹\s*)?CLIP\s*\d+/gi);
  return clipMatches !== null && clipMatches.length >= 2;
}

/**
 * Parse un prompt multi-clips et extrait chaque clip avec ses specs
 */
export function parseMultiClipPrompt(prompt: string): MultiClipResult {
  // Résultat par défaut si pas multi-clip
  if (!isMultiClipPrompt(prompt)) {
    return {
      isMultiClip: false,
      clipCount: 1,
      globalStyle: "",
      globalRules: "",
      clips: [{
        clipNumber: 1,
        title: "VIDEO",
        keyframe: prompt,
        textLines: extractTextLines(prompt),
        animation: "",
        durationSec: 8,
      }],
    };
  }

  // Extraire le style global (tout avant CLIP 1)
  const beforeClipsMatch = prompt.match(/^([\s\S]*?)(?=(?:📹\s*)?CLIP\s*1)/i);
  const globalSection = beforeClipsMatch?.[1] || "";
  
  // Parser les sections globales
  const globalStyle = extractGlobalStyle(globalSection);
  const globalRules = extractGlobalRules(globalSection);

  // Diviser par CLIP N
  const clipRegex = /(?:📹\s*)?CLIP\s*(\d+)\s*(?:\([^)]*\))?\s*[—–-]*\s*(\d+)?s?\s*([\s\S]*?)(?=(?:📹\s*)?CLIP\s*\d+|✅\s*SORTIE|$)/gi;
  const clips: ParsedClip[] = [];
  let match: RegExpExecArray | null;

  while ((match = clipRegex.exec(prompt)) !== null) {
    const clipNumber = parseInt(match[1], 10);
    const explicitDuration = match[2] ? parseInt(match[2], 10) : 8;
    const clipContent = match[3] || "";

    // Extraire titre du clip (HOOK, CONTENU, CTA, etc.)
    const titleMatch = clipContent.match(/^\s*\(?([A-Z]+)\)?/);
    const title = titleMatch?.[1] || `CLIP ${clipNumber}`;

    // Extraire Keyframe
    const keyframeMatch = clipContent.match(/Keyframe\s*:?\s*([\s\S]*?)(?=Animation\s*:|$)/i);
    const keyframe = keyframeMatch?.[1]?.trim() || "";

    // Extraire Animation
    const animationMatch = clipContent.match(/Animation\s*:?\s*([\s\S]*?)$/i);
    const animation = animationMatch?.[1]?.trim() || "";

    // Extraire les lignes de texte (entre guillemets)
    const textLines = extractTextLines(keyframe);

    clips.push({
      clipNumber,
      title,
      keyframe,
      textLines,
      animation,
      durationSec: explicitDuration,
    });
  }

  console.log(`[multiClipParser] Parsed ${clips.length} clips:`, 
    clips.map(c => ({ n: c.clipNumber, title: c.title, texts: c.textLines.length }))
  );

  return {
    isMultiClip: true,
    clipCount: clips.length,
    globalStyle,
    globalRules,
    clips,
  };
}

/**
 * Extrait les lignes de texte entre guillemets d'une section
 */
function extractTextLines(section: string): string[] {
  const lines: string[] = [];
  
  // Pattern 1: "Ligne X : ..." dans Keyframe
  const linePatterns = section.matchAll(/Ligne\s*\d+\s*:\s*["«]([^"»]+)["»]/gi);
  for (const m of linePatterns) {
    if (m[1]?.trim()) lines.push(m[1].trim());
  }
  
  // Pattern 2: Textes directs entre guillemets (si pas déjà trouvés)
  if (lines.length === 0) {
    const quotedTexts = section.matchAll(/["«]([^"»]{5,100})["»]/g);
    for (const m of quotedTexts) {
      const text = m[1]?.trim();
      // Exclure les mots techniques
      if (text && !isExcludedText(text)) {
        lines.push(text);
      }
    }
  }
  
  return lines;
}

/**
 * Vérifie si un texte extrait doit être exclu (mots techniques)
 */
function isExcludedText(text: string): boolean {
  const excludedPatterns = [
    /^(BRIEF|RÉSULTAT|MIX|HOOK|CTA|CONTENU)$/i,
    /^user.avatar/i,
    /^avatar/i,
    /^\d+[%s]$/,
    /scale|opacity|zoom|pan|fade/i,
  ];
  return excludedPatterns.some(p => p.test(text));
}

/**
 * Extrait le style global du prompt (palette, mode, ambiance)
 */
function extractGlobalStyle(section: string): string {
  const stylePatterns = [
    /STYLE\s*(?:GLOBAL)?\s*:?\s*([\s\S]*?)(?=🚫|INTERDIT|TEXT\s*LOCK|$)/i,
    /Ambiance\s*:\s*([^\n]+)/i,
    /Mode\s*:\s*([^\n]+)/i,
    /Palette\s*:\s*([^\n]+)/i,
  ];
  
  const parts: string[] = [];
  for (const pattern of stylePatterns) {
    const match = section.match(pattern);
    if (match?.[1]?.trim()) {
      parts.push(match[1].trim());
    }
  }
  
  return parts.join(". ");
}

/**
 * Extrait les règles globales (interdit, text lock)
 */
function extractGlobalRules(section: string): string {
  const rulesPatterns = [
    /🚫\s*INTERDIT\s*([\s\S]*?)(?=🔒|TEXT\s*LOCK|📝|$)/i,
    /INTERDIT\s*:?\s*([\s\S]*?)(?=🔒|TEXT\s*LOCK|📝|$)/i,
    /TEXT\s*LOCK\s*[:(]?\s*([\s\S]*?)(?=📝|CONTENU|$)/i,
  ];
  
  const parts: string[] = [];
  for (const pattern of rulesPatterns) {
    const match = section.match(pattern);
    if (match?.[1]?.trim()) {
      parts.push(match[1].trim());
    }
  }
  
  return parts.join("\n");
}

/**
 * Construit le prompt visuel pour un clip spécifique
 * Combine style global + keyframe du clip + instructions d'animation
 */
export function buildClipVisualPrompt(
  clip: ParsedClip, 
  globalStyle: string,
  globalRules: string,
): string {
  const parts: string[] = [];
  
  // Style global simplifié (pour le moteur vidéo)
  if (globalStyle) {
    // Extraire juste les éléments visuels clés
    const styleKeywords = globalStyle.match(/(premium|moderne|fun|minimaliste|light\s*mode|dark\s*mode|mint|pastel|rose|pêche|lavande)/gi);
    if (styleKeywords?.length) {
      parts.push(`Style: ${styleKeywords.slice(0, 5).join(", ")}`);
    }
  }
  
  // Keyframe nettoyé (sans les instructions texte)
  let visualKeyframe = clip.keyframe
    .replace(/TEXTE[^:]*:[\s\S]*?(?=Animation|$)/gi, "")
    .replace(/Ligne\s*\d+\s*:[^\n]*/gi, "")
    .replace(/IMPORTANT[^.]*\./gi, "")
    .replace(/["«][^"»]*["»]/g, "") // Retirer textes entre guillemets
    .replace(/\s+/g, " ")
    .trim();
  
  if (visualKeyframe) {
    parts.push(visualKeyframe);
  }
  
  // Animation simplifiée
  if (clip.animation) {
    const animKeywords = clip.animation.match(/(push-in|zoom|pan|micro|lent|pulse|parallax)/gi);
    if (animKeywords?.length) {
      parts.push(`Camera: ${animKeywords.slice(0, 3).join(", ")}`);
    }
  }
  
  // Règle anti-texte parasite (sauf celui demandé)
  parts.push("NO unexpected text. Only display text that is explicitly provided.");
  
  return parts.join(". ") + ".";
}
