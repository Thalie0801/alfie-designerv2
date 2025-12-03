/**
 * Sanitization des prompts vidéo pour éviter les violations de politique VEO 3
 * 
 * Règles Vertex AI :
 * - Pas de marques déposées (Coca-Cola, Nike, Apple, etc.)
 * - Pas de références à des personnes réelles (célébrités, photos)
 * - Pas de contenu violent/inapproprié
 */

// Dictionnaire de remplacement des marques commerciales
export const BRAND_REPLACEMENTS: Record<string, string> = {
  // Boissons
  "coca-cola": "a refreshing cola beverage",
  "coca cola": "a refreshing cola beverage",
  "pepsi": "a refreshing cola drink",
  "red bull": "an energy drink can",
  "monster energy": "an energy drink can",
  "starbucks": "a premium coffee cup",
  "nespresso": "an espresso machine",
  "nestle": "a food brand product",
  "evian": "a mineral water bottle",
  "perrier": "a sparkling water bottle",
  
  // Tech
  "apple": "a premium smartphone",
  "iphone": "a modern smartphone",
  "ipad": "a modern tablet",
  "macbook": "a sleek laptop",
  "samsung": "a modern electronic device",
  "google": "a tech company",
  "microsoft": "a software interface",
  "tesla": "an electric vehicle",
  "nvidia": "a tech company",
  "intel": "a tech company",
  "playstation": "a gaming console",
  "xbox": "a gaming console",
  "nintendo": "a gaming device",
  
  // Mode & Luxe
  "nike": "athletic sportswear",
  "adidas": "sporty athletic wear",
  "puma": "athletic sportswear",
  "gucci": "luxury fashion item",
  "louis vuitton": "designer luxury bag",
  "chanel": "elegant perfume bottle",
  "dior": "luxury fashion item",
  "rolex": "luxury wristwatch",
  "hermes": "designer accessory",
  "prada": "luxury fashion item",
  "versace": "designer fashion item",
  "cartier": "luxury jewelry",
  "tiffany": "fine jewelry",
  "zara": "fashion clothing",
  "h&m": "fashion clothing",
  
  // Fast Food & Restaurants
  "mcdonald's": "a fast food restaurant",
  "mcdonalds": "a fast food restaurant",
  "burger king": "a burger restaurant",
  "kfc": "fried chicken meal",
  "subway": "a sandwich shop",
  "pizza hut": "a pizza restaurant",
  "domino's": "a pizza restaurant",
  "wendy's": "a fast food restaurant",
  "taco bell": "a mexican restaurant",
  "dunkin": "a coffee shop",
  
  // Auto
  "bmw": "a luxury car",
  "mercedes": "a premium sedan",
  "ferrari": "a red sports car",
  "lamborghini": "an exotic sports car",
  "porsche": "a sports car",
  "audi": "a premium vehicle",
  "volkswagen": "a car",
  "toyota": "a vehicle",
  "ford": "an american car",
  "chevrolet": "an american car",
  "jaguar": "a luxury vehicle",
  "bentley": "a luxury vehicle",
  "rolls-royce": "an ultra-luxury vehicle",
  "maserati": "a sports car",
  
  // Tech & Social
  "amazon": "an online shopping package",
  "netflix": "a streaming service interface",
  "spotify": "a music streaming app",
  "instagram": "a social media app",
  "tiktok": "a short video app",
  "facebook": "a social network",
  "twitter": "a social platform",
  "youtube": "a video platform",
  "linkedin": "a professional network",
  "snapchat": "a messaging app",
  "whatsapp": "a messaging app",
  "uber": "a ride-sharing service",
  "airbnb": "a vacation rental",
  
  // Autres marques
  "ikea": "a furniture store",
  "walmart": "a retail store",
  "target": "a retail store",
  "costco": "a wholesale store",
  "disney": "an entertainment company",
  "marvel": "superhero content",
  "warner bros": "a film studio",
  "sony": "an electronics company",
  "canon": "a camera",
  "nikon": "a camera",
  "gopro": "an action camera",
  "lego": "building blocks",
  "barbie": "a fashion doll"
};

// Patterns qui indiquent une référence à une personne réelle
const PERSON_REFERENCE_PATTERNS = [
  /(?:from|in|with)\s+(?:the\s+)?(?:attached|uploaded|provided|reference|my)\s+(?:photo|image|picture)/gi,
  /(?:person|man|woman|people|face)\s+(?:from|in)\s+(?:the\s+)?(?:photo|image|picture)/gi,
  /(?:like|as|resembling)\s+(?:the\s+)?(?:attached|provided|uploaded)\s+(?:person|face|photo)/gi,
  /(?:celebrity|famous|star|actor|actress|singer|politician|president)/gi,
  // Célébrités spécifiques (liste non exhaustive)
  /\b(?:elon\s*musk|donald\s*trump|joe\s*biden|emmanuel\s*macron|barack\s*obama)\b/gi,
  /\b(?:beyoncé|beyonce|taylor\s*swift|kim\s*kardashian|kanye\s*west|rihanna)\b/gi,
  /\b(?:brad\s*pitt|angelina\s*jolie|tom\s*cruise|leonardo\s*dicaprio|johnny\s*depp)\b/gi,
  /\b(?:cristiano\s*ronaldo|lionel\s*messi|lebron\s*james|michael\s*jordan)\b/gi,
  /\b(?:jeff\s*bezos|mark\s*zuckerberg|bill\s*gates|steve\s*jobs)\b/gi,
  /\b(?:oprah\s*winfrey|ellen\s*degeneres|jimmy\s*fallon|joe\s*rogan)\b/gi
];

// Texte de remplacement pour les références aux personnes
const PERSON_REPLACEMENT = "a professional person";

export interface SanitizeResult {
  sanitizedPrompt: string;
  wasModified: boolean;
  replacements: Array<{ original: string; replacement: string; reason: string }>;
  warnings: string[];
}

/**
 * Échappe les caractères spéciaux pour une utilisation dans une regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize un prompt vidéo pour éviter les violations de politique VEO 3
 */
export function sanitizeVideoPrompt(prompt: string): SanitizeResult {
  let sanitizedPrompt = prompt;
  const replacements: Array<{ original: string; replacement: string; reason: string }> = [];
  const warnings: string[] = [];
  
  // 1. Remplacer les marques commerciales (case-insensitive)
  for (const [brand, replacement] of Object.entries(BRAND_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${escapeRegex(brand)}\\b`, 'gi');
    const matches = sanitizedPrompt.match(regex);
    if (matches) {
      for (const match of matches) {
        sanitizedPrompt = sanitizedPrompt.replace(new RegExp(escapeRegex(match), 'g'), replacement);
        replacements.push({
          original: match,
          replacement,
          reason: "trademark"
        });
        console.log(`[promptSanitizer] Replaced trademark: "${match}" → "${replacement}"`);
      }
    }
  }
  
  // 2. Détecter et remplacer les références aux personnes réelles
  for (const pattern of PERSON_REFERENCE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = sanitizedPrompt.match(pattern);
    if (matches) {
      for (const match of matches) {
        sanitizedPrompt = sanitizedPrompt.replace(match, PERSON_REPLACEMENT);
        replacements.push({
          original: match,
          replacement: PERSON_REPLACEMENT,
          reason: "person_reference"
        });
        console.log(`[promptSanitizer] Replaced person reference: "${match}"`);
      }
    }
  }
  
  // 3. Ajouter des warnings pour les cas détectés
  if (replacements.some(r => r.reason === "trademark")) {
    warnings.push("Des marques commerciales ont été remplacées par des descriptions génériques.");
  }
  if (replacements.some(r => r.reason === "person_reference")) {
    warnings.push("Les références à des personnes réelles ont été remplacées par des descriptions génériques.");
  }
  
  return {
    sanitizedPrompt: sanitizedPrompt.trim(),
    wasModified: replacements.length > 0,
    replacements,
    warnings
  };
}

/**
 * Génère un message d'erreur user-friendly pour les violations de contenu
 */
export function generateContentPolicyError(sanitizeResult: SanitizeResult): {
  message: string;
  suggestions: string[];
} {
  const brandIssues = sanitizeResult.replacements.filter(r => r.reason === "trademark");
  const personIssues = sanitizeResult.replacements.filter(r => r.reason === "person_reference");
  
  let message = "Ton prompt a été ajusté pour respecter les règles de génération vidéo.";
  const suggestions: string[] = [];
  
  if (brandIssues.length > 0) {
    message += ` ${brandIssues.length} marque(s) remplacée(s).`;
    suggestions.push("Utilise des descriptions génériques (ex: 'cola' au lieu de 'Coca-Cola')");
    suggestions.push("Décris le type de produit plutôt que la marque");
  }
  
  if (personIssues.length > 0) {
    message += ` ${personIssues.length} référence(s) à des personnes remplacée(s).`;
    suggestions.push("Évite les références à des photos de personnes réelles");
    suggestions.push("Utilise des descriptions génériques pour les personnages");
  }
  
  return { message, suggestions };
}

/**
 * Détecte si une erreur VEO 3 est liée à une violation de politique de contenu
 */
export function isContentPolicyViolation(errorText: string): boolean {
  const lowerError = errorText.toLowerCase();
  return (
    lowerError.includes("violate") ||
    lowerError.includes("usage guidelines") ||
    lowerError.includes("content policy") ||
    lowerError.includes("could not be submitted") ||
    lowerError.includes("inappropriate") ||
    lowerError.includes("not allowed")
  );
}
