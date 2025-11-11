import { QUICK_INTENTS } from "@/config/alfieAI";

export type IntentType =
  | "open_canva"
  | "show_brandkit"
  | "check_credits"
  | "show_usage"
  | "package_download"
  | "browse_templates"
  | "generate_image"
  | "unknown";

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  params?: Record<string, any>;
}

// --------- Config & Helpers ---------

const CONFIDENCE = {
  HIGH: 0.9,
  MED: 0.85,
  LOW: 0.8,
};

const VIDEO_WORDS = ["video", "vidéo", "reel", "réel", "tiktok", "short", "shorts", "clip", "story", "stories"];

const CAROUSEL_WORDS = ["carrousel", "carousel", "diaporama", "slides", "slide", "série", "serie"];

const IMAGE_WORDS = [
  "image",
  "visuel",
  "cover",
  "miniature",
  "vignette",
  "photo",
  "illustration",
  "banniere",
  "bannière",
  "banner",
];

const NEGATIONS = ["pas", "sans", "pas de", "ne pas", "ne veux pas", "ne souhaite pas"];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  social_media: [
    "post",
    "story",
    "stories",
    "instagram",
    "tiktok",
    "facebook",
    "linkedin",
    "x ",
    "twitter",
    "reel",
    "réel",
  ],
  marketing: ["flyer", "affiche", "brochure", "email", "newsletter", "presentation", "présentation", "slide", "slides"],
  ecommerce: ["fiche produit", "product card", "catalogue", "carte produit", "mockup", "annonce", "listing"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD") // accents -> lettres + diacritiques
    .replace(/[\u0300-\u036f]/g, ""); // supprime diacritiques
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => new RegExp(`\\b${escapeRegExp(normalize(w))}\\b`, "i").test(text));
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNegationAround(text: string, targetWords: string[]): boolean {
  // Heuristique: si une négation apparaît dans une fenêtre proche, on la considère comme négation
  // Ex: "je ne veux pas d'image" / "sans image"
  const negationRe = new RegExp(`\\b(${NEGATIONS.map(escapeRegExp).join("|")})\\b`, "i");
  const targetRe = new RegExp(`\\b(${targetWords.map((w) => escapeRegExp(normalize(w))).join("|")})\\b`, "i");
  return negationRe.test(text) && targetRe.test(text);
}

// --------- Détection image ---------

/**
 * Détecte si le texte contient une demande de génération d'image,
 * en excluant explicitement carrousel/vidéo/story/etc. et en gérant la négation.
 */
export function wantsImageFromText(raw: string): boolean {
  const t = normalize(raw);

  // Exclusions fortes
  if (includesAny(t, CAROUSEL_WORDS)) return false;
  if (includesAny(t, VIDEO_WORDS)) return false;

  // Négation ciblée
  if (hasNegationAround(t, IMAGE_WORDS)) return false;

  // Mots image
  return includesAny(t, IMAGE_WORDS);
}

// --------- Détection Intent principale ---------

export function detectIntent(userMessage: string): DetectedIntent {
  const msg = userMessage.trim();
  const n = normalize(msg);

  // 🚨 PRIORITÉ 1: carrousel => on passe à l'IA
  if (includesAny(n, CAROUSEL_WORDS)) {
    return { type: "unknown", confidence: 0 };
  }

  // Vidéo explicite => laisse l’IA (peut nécessiter des paramètres)
  if (includesAny(n, VIDEO_WORDS)) {
    return { type: "unknown", confidence: 0 };
  }

  // Open Canva (sécurisé après les checks précédents)
  if (QUICK_INTENTS.openCanva?.test?.(msg) || QUICK_INTENTS.openCanva?.test?.(n)) {
    return { type: "open_canva", confidence: CONFIDENCE.HIGH };
  }

  // Show Brand Kit
  if (QUICK_INTENTS.showBrandKit?.test?.(msg) || QUICK_INTENTS.showBrandKit?.test?.(n)) {
    return { type: "show_brandkit", confidence: CONFIDENCE.HIGH };
  }

  // Check credits
  if (QUICK_INTENTS.checkCredits?.test?.(msg) || QUICK_INTENTS.checkCredits?.test?.(n)) {
    return { type: "check_credits", confidence: CONFIDENCE.HIGH };
  }

  // Show usage
  if (QUICK_INTENTS.showUsage?.test?.(msg) || QUICK_INTENTS.showUsage?.test?.(n)) {
    return { type: "show_usage", confidence: CONFIDENCE.HIGH };
  }

  // Package download
  if (QUICK_INTENTS.packageDownload?.test?.(msg) || QUICK_INTENTS.packageDownload?.test?.(n)) {
    return { type: "package_download", confidence: CONFIDENCE.HIGH };
  }

  // Détection image locale
  if (wantsImageFromText(msg)) {
    return {
      type: "generate_image",
      confidence: CONFIDENCE.LOW,
      params: { prompt: msg },
    };
  }

  // Parcours templates – tentative d’extraction catégorie
  const detectedCategory = detectCategory(n);
  if (detectedCategory) {
    return {
      type: "browse_templates",
      confidence: CONFIDENCE.MED,
      params: { category: detectedCategory },
    };
  }

  // Aucune intention détectée → IA
  return { type: "unknown", confidence: 0 };
}

function detectCategory(n: string): string | null {
  // Si les regex "rapides" existent, on les exploite d'abord
  if (QUICK_INTENTS.socialMedia?.test?.(n)) return "social_media";
  if (QUICK_INTENTS.marketing?.test?.(n)) return "marketing";
  if (QUICK_INTENTS.ecommerce?.test?.(n)) return "ecommerce";

  // Sinon, heuristique par mots-clés
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (includesAny(n, words)) return cat;
  }
  return null;
}

// --------- Routing local / court-circuit IA ---------

/**
 * Vérifie si le message peut être géré sans IA (short call)
 * On garde un seuil élevé pour éviter les faux positifs.
 */
export function canHandleLocally(intent: DetectedIntent): boolean {
  if (intent.type === "unknown") return false;
  // On restreint volontairement aux actions vraiment sûres
  const locallySafe: IntentType[] = [
    "open_canva",
    "show_brandkit",
    "check_credits",
    "show_usage",
    "package_download",
    "browse_templates",
  ];
  return intent.confidence >= CONFIDENCE.MED && locallySafe.includes(intent.type);
}

/**
 * Génère une réponse rapide locale si possible
 * (renvoie du texte, sinon null pour laisser l’IA)
 */
export function generateLocalResponse(intent: DetectedIntent): string | null {
  switch (intent.type) {
    case "open_canva":
      // On laisse souvent l’IA préciser le contexte, donc null possible.
      return null;

    case "show_brandkit":
      return "Je vais te montrer ton Brand Kit actuel 🐾";

    case "check_credits":
      return "Je vérifie ton solde de crédits IA ✨";

    case "show_usage":
      return "Je regarde tes compteurs de quotas (visuels, vidéos, Woofs) 📊";

    case "package_download":
      return "Je prépare un package avec tous tes assets ! 📦";

    case "browse_templates": {
      const cat = intent.params?.category as string | undefined;
      if (cat === "social_media") return "Je t’ouvre les templates Social Media 📱";
      if (cat === "marketing") return "Je t’ouvre les templates Marketing 📣";
      if (cat === "ecommerce") return "Je t’ouvre les templates e-commerce 🛒";
      return "Je t’ouvre la galerie de templates ✨";
    }

    // Pour generate_image / unknown → on laisse l’IA
    default:
      return null;
  }
}
