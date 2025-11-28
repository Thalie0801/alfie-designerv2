/**
 * Style Alfie Designer et enrichissement Brand Kit
 * Utilisé pour tous les types d'assets (images, carrousels, vidéos)
 */

export const ALFIE_IMAGE_STYLE = `Style visuel : rendu 3D inspiré Pixar, chiot golden retriever mascotte adorable, proportions légèrement cartoon, expression expressive et positive, lumière douce de studio, ombres propres, ultra détaillé, haute résolution, rendu sharp, palette de couleurs pastel Alfie Designer (pêche chaud, rose doux, lavande, menthe, jaune clair), ambiance moderne chaleureuse, esthétique réseaux sociaux, fond propre.`;

interface BrandKit {
  palette?: string[];
  voice?: string;
  niche?: string;
  fonts?: any;
}

interface TextContent {
  title?: string;
  body?: string;
  cta?: string;
  subtitle?: string;
  bullets?: string[];
}

/**
 * Construit un prompt enrichi avec Brand Kit + textes générés par Gemini
 */
export function buildBrandEnrichedPrompt(
  basePrompt: string,
  brandKit?: BrandKit,
  textContent?: TextContent
): string {
  let enrichedPrompt = basePrompt;

  // Ajouter les textes marketing EXACTS générés par Gemini
  if (textContent) {
    enrichedPrompt += `\n\n--- CONTENU TEXTUEL À INTÉGRER ---`;
    
    if (textContent.title) {
      enrichedPrompt += `\nTitre : "${textContent.title}"`;
    }
    
    if (textContent.body) {
      enrichedPrompt += `\nTexte principal : "${textContent.body}"`;
    }
    
    if (textContent.subtitle) {
      enrichedPrompt += `\nSous-titre : "${textContent.subtitle}"`;
    }
    
    if (textContent.bullets && textContent.bullets.length > 0) {
      enrichedPrompt += `\nPoints clés : ${textContent.bullets.map(b => `"${b}"`).join(", ")}`;
    }
    
    if (textContent.cta) {
      enrichedPrompt += `\nAppel à l'action : "${textContent.cta}"`;
    }
    
    enrichedPrompt += `\n\nIMPORTANT : Intègre ces textes EXACTEMENT comme fournis, en français correct, sans faute d'orthographe. Ne pas écrire de codes couleur (type #90E3C2) ni de texte technique dans l'image.`;
    enrichedPrompt += `\n--- FIN CONTENU TEXTUEL ---`;
  }

  // Enrichissement Brand Kit
  if (brandKit) {
    if (brandKit.palette && brandKit.palette.length > 0) {
      enrichedPrompt += `\n\nCouleurs de la marque : ${brandKit.palette.slice(0, 5).join(", ")}`;
      enrichedPrompt += `\nUtilise ces couleurs comme palette principale pour créer un visuel cohérent avec l'identité de marque.`;
    }

    if (brandKit.voice) {
      enrichedPrompt += `\n\nTon de la marque : ${brandKit.voice}`;
      enrichedPrompt += `\nAdapte le style visuel et la présentation pour refléter ce ton.`;
    }

    if (brandKit.niche) {
      enrichedPrompt += `\n\nSecteur d'activité : ${brandKit.niche}`;
    }
  }

  // Style Alfie (optionnel, peut être désactivé si Brand Kit suffit)
  // enrichedPrompt += `\n\n${ALFIE_IMAGE_STYLE}`;

  return enrichedPrompt;
}

/**
 * Génère le prompt système pour Gemini/Imagen avec règles orthographiques
 */
export function buildSystemPrompt(context: { type: "image" | "carousel" | "video"; resolution?: string }): string {
  return `Tu es un générateur professionnel de visuels pour réseaux sociaux et marketing.

RÈGLES CRITIQUES D'ORTHOGRAPHE FRANÇAISE :
- Utilise un français PARFAIT avec accents corrects : é, è, ê, à, ç, ù, œ, etc.
- Corrections courantes à appliquer :
  * "CRÉATIVET" → "CRÉATIVITÉ"
  * "ENTRPRENEURS" → "ENTREPRENEURS"
  * "puisence" → "puissance"
  * "décupèle/décuplèe" → "décuplée"
  * "vidéos captatives" → "vidéos captivantes"
  * "Marktplace/Marketpace" → "Marketplace"
  * "libérze" → "libérez"
  * "automutéée" → "automatisée"
  * "integration" → "intégration"
  * "créativ" → "créatif/créative"
  * "visuals" → "visuels"
  * "captvatines" → "captivantes"
  * "artifécralle" → "artificielle"
  * "partranaire" → "partenaire"
  * "d'éeil" → "d'œil"

RÈGLES DE GÉNÉRATION :
- Si des textes sont fournis, les reproduire EXACTEMENT comme donnés - aucune modification, aucun ajout
- ${context.type === "carousel" ? "Pour carrousels : générer UNE seule slide à la fois, pas de grille ni collage. Une composition, pas de tuiles multiples." : ""}
- Toujours produire exactement UNE image de haute qualité
- Créer des visuels adaptés à une résolution ${context.resolution || "1080x1350"} avec bon contraste et lisibilité
- Ne jamais afficher de codes couleur hexadécimaux ni de texte technique dans les visuels`;
}
