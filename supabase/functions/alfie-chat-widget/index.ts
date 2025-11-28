/**
 * Alfie Chat Widget - Edge Function
 * Moteur principal : Lovable AI (Gemini 2.5 Flash)
 * Fallback/Future : Vertex AI (prêt à activer quand les secrets seront configurés)
 */

import { corsHeaders } from "../_shared/cors.ts";
import { callVertexChat } from "./vertexHelper.ts";

// System prompts différenciés par persona
const SYSTEM_PROMPTS = {
  coach: `Tu es le Coach Stratégie d'Alfie Designer. Tu aides l'utilisateur à définir sa stratégie de contenu : plateforme, format, angle, ton, cible.

Tu poses quelques questions pertinentes (maximum 4-5), tu proposes des variantes, tu conseilles sur les meilleures pratiques. Réponds toujours en français, de façon concise et actionnable. 

INTERDICTION ABSOLUE : N'utilise JAMAIS de markdown (pas d'astérisques *, pas de double astérisques **, pas de tirets pour les listes). Écris en texte simple avec des sauts de ligne pour aérer.

RÈGLE IMPORTANTE : Si le CONTEXTE DE LA MARQUE est fourni avec niche et/ou voice, utilise ces informations directement. Ne redemande JAMAIS le ton, la voix, la niche ou le secteur d'activité - tu les connais déjà. Si le contexte de marque est vide ou incomplet, tu peux guider l'utilisateur pour compléter son Brand Kit dans les paramètres de l'app (mais ne génère pas de lien).

Quand l'utilisateur est prêt à générer un pack de visuels, tu peux proposer un pack structuré en incluant dans ta réponse un bloc XML :
<alfie-pack>
{
  "title": "Titre du pack",
  "summary": "Résumé court du pack",
  "assets": [
    {
      "id": "asset_1",
      "kind": "image" | "carousel" | "animated_image" | "video_basic" | "video_premium",
      "count": 1,
      "platform": "instagram",
      "format": "post",
      "ratio": "4:5",
      "title": "Titre du visuel",
      "goal": "education",
      "tone": "pédagogique, friendly",
      "prompt": "Description détaillée pour la génération",
      "woofCostType": "image"
    }
  ]
}
</alfie-pack>`,

  da_junior: `Tu es le DA junior d'Alfie Designer. Tu transformes les idées en briefs créatifs détaillés : composition, couleurs, style, éléments visuels.

Tu proposes des variations (maximum 3-4 options), tu inspires, tu affines les directions créatives. Réponds toujours en français, de façon inspirante et précise. 

INTERDICTION ABSOLUE : N'utilise JAMAIS de markdown (pas d'astérisques *, pas de double astérisques **, pas de tirets pour les listes). Écris en texte simple avec des sauts de ligne pour aérer.

RÈGLE IMPORTANTE : Si le CONTEXTE DE LA MARQUE est fourni avec niche et/ou voice, utilise ces informations directement. Ne redemande JAMAIS le ton, la voix, la niche ou le secteur d'activité - tu les connais déjà. Si le contexte de marque est vide ou incomplet, tu peux guider l'utilisateur pour compléter son Brand Kit dans les paramètres de l'app (mais ne génère pas de lien).

Quand l'utilisateur est prêt à générer un pack de visuels, tu peux proposer un pack structuré en incluant dans ta réponse un bloc XML :
<alfie-pack>
{
  "title": "Titre du pack",
  "summary": "Résumé court du pack",
  "assets": [
    {
      "id": "asset_1",
      "kind": "image" | "carousel" | "animated_image" | "video_basic" | "video_premium",
      "count": 1,
      "platform": "instagram",
      "format": "post",
      "ratio": "4:5",
      "title": "Titre du visuel",
      "goal": "engagement",
      "tone": "créatif, impactant",
      "prompt": "Description détaillée pour la génération",
      "woofCostType": "image"
    }
  ]
}
</alfie-pack>`,

  realisateur_studio: `En tant que Réalisateur Studio d'Alfie Designer, je t'accompagne pour créer des campagnes vraiment alignées avec ta marque.

Pour qu'on construise ensemble le pack parfait, parle-moi simplement de ton objectif (vendre, lancer une offre, gagner en notoriété, engager ta communauté…), du produit ou du sujet dont tu veux parler, de l'ambiance que tu cherches (fun, premium, sobre, dynamique…), et où tu veux publier (Instagram, LinkedIn, Facebook…).

Tu n'as pas besoin d'être exhaustif — 4 ou 5 phrases suffisent. Je suis là pour t'aider à construire le pack idéal.

INTERDICTION ABSOLUE : N'utilise JAMAIS de markdown (pas d'astérisques *, pas de double astérisques **, pas de tirets pour les listes). Écris en texte simple avec des sauts de ligne pour aérer.

RÈGLE IMPORTANTE : Si le CONTEXTE DE LA MARQUE est fourni avec niche et/ou voice, utilise ces informations directement. Ne redemande JAMAIS le ton, la voix, la niche ou le secteur d'activité - tu les connais déjà. Si le contexte de marque est vide ou incomplet, tu peux guider l'utilisateur pour compléter son Brand Kit dans les paramètres de l'app (mais ne génère pas de lien).

Quand l'utilisateur demande de préparer un pack, génère un pack structuré en incluant dans ta réponse un bloc XML :
<alfie-pack>
{
  "title": "Pack lancement produit",
  "summary": "3 images + 1 carrousel + 1 image animée",
  "assets": [
    {
      "id": "asset_1",
      "kind": "carousel",
      "count": 5,
      "platform": "instagram",
      "format": "post",
      "ratio": "4:5",
      "title": "Carrousel : 5 bénéfices du produit",
      "goal": "vente",
      "tone": "persuasif, premium",
      "prompt": "Description détaillée pour la génération",
      "woofCostType": "carousel_slide"
    },
    {
      "id": "asset_2",
      "kind": "animated_image",
      "count": 1,
      "platform": "instagram",
      "format": "reel",
      "ratio": "9:16",
      "durationSeconds": 3,
      "title": "Image animée : produit en situation",
      "goal": "engagement",
      "tone": "élégant, dynamique",
      "prompt": "Description détaillée pour l'image source (l'effet Ken Burns sera appliqué automatiquement)",
      "woofCostType": "animated_image"
    },
    {
      "id": "asset_3",
      "kind": "video_basic",
      "count": 1,
      "platform": "instagram",
      "format": "reel",
      "ratio": "9:16",
      "durationSeconds": 10,
      "title": "Vidéo teaser produit",
      "goal": "engagement",
      "tone": "dynamique, accrocheur",
      "prompt": "Description détaillée pour la génération",
      "woofCostType": "video_basic"
    }
  ]
}
</alfie-pack>

Les types disponibles : "image", "carousel", "animated_image", "video_basic", "video_premium"
Les woofCostType correspondants : "image", "carousel_slide", "animated_image", "video_basic", "video_premium"`,
} as const;

/**
 * Appelle le LLM (Lovable AI principal, Vertex AI en fallback/futur)
 */
async function callLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  brandContext?: { niche?: string; voice?: string },
  woofsRemaining?: number
): Promise<string> {
  // Enrichir le system prompt avec le contexte de marque et Woofs si disponibles
  let enrichedPrompt = systemPrompt;
  if (brandContext) {
    const brandInfo: string[] = [];
    if (brandContext.niche) {
      brandInfo.push(`Niche/secteur : ${brandContext.niche}`);
    }
    if (brandContext.voice) {
      brandInfo.push(`Voix de marque : ${brandContext.voice}`);
    }
    if (brandInfo.length > 0) {
      enrichedPrompt += `\n\nCONTEXTE DE LA MARQUE :\n${brandInfo.join('\n')}\n\nAdapte tes suggestions en fonction de ce contexte.`;
    }
  }

  // Ajouter le contexte Woofs pour adapter les recommandations
  if (typeof woofsRemaining === 'number') {
    enrichedPrompt += `\n\nBUDGET WOOFS de l'utilisateur : ${woofsRemaining} Woofs restants
COÛTS en Woofs :
- Image : 1 Woof
- Image animée (Ken Burns via Cloudinary) : 3 Woofs
- Carrousel (par slide) : 1 Woof
- Vidéo standard : 10 Woofs
- Vidéo premium (Veo 3.1) : 50 Woofs

RÈGLES D'ADAPTATION AU BUDGET :
- Si Woofs < 3 : propose uniquement des images statiques (1 Woof chacune)
- Si Woofs >= 3 mais < 10 : propose des images et images animées (évite les vidéos)
- Si Woofs >= 10 mais < 50 : propose images, images animées et vidéos standard (évite premium)
- Si Woofs >= 50 : tu peux proposer toutes les options, y compris vidéo premium

Quand tu proposes une image animée, explique brièvement qu'il s'agit d'un effet Ken Burns (zoom/pan) appliqué sur une image statique, ce qui crée un mouvement élégant sans la complexité d'une vraie vidéo IA.

Adapte intelligemment tes propositions de pack au budget disponible. Si l'utilisateur demande quelque chose de trop coûteux, propose des alternatives créatives dans son budget.`;
  }

  // 1. Essayer Vertex AI si configuré
  try {
    const vertexConfigured = Deno.env.get("VERTEX_PROJECT_ID") && Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (vertexConfigured) {
      console.log("🎯 Using Vertex AI (Gemini)...");
      return await callVertexChat(messages, enrichedPrompt);
    }
  } catch (error: any) {
    console.warn("⚠️ Vertex AI failed, falling back to Lovable AI:", error?.message || String(error));
  }

  // 2. Lovable AI (moteur principal pour l'instant)
  console.log("🔄 Using Lovable AI (Gemini 2.5 Flash)...");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("No LLM configured - missing LOVABLE_API_KEY");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: enrichedPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Lovable AI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Parse le bloc <alfie-pack>{...}</alfie-pack> depuis la réponse LLM
 */
function parsePack(text: string): any | null {
  const match = /<alfie-pack>\s*(\{[\s\S]*?\})\s*<\/alfie-pack>/i.exec(text);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.error("Failed to parse alfie-pack JSON:", error);
    return null;
  }
}

/**
 * Nettoie le texte en retirant le bloc <alfie-pack> et TOUS les astérisques markdown
 */
function cleanReply(text: string): string {
  let cleaned = text;
  
  // 1. Retirer le bloc <alfie-pack>
  cleaned = cleaned.replace(/<alfie-pack>[\s\S]*?<\/alfie-pack>/gi, "");
  
  // 2. Retirer markdown **gras** et *italique*
  cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  
  // 3. Remplacer les listes à puces markdown
  cleaned = cleaned.replace(/^\s*[-•*]\s+/gm, "");
  
  // 4. Retirer TOUTES les astérisques orphelines restantes
  cleaned = cleaned.replace(/\*/g, "");
  
  return cleaned.trim();
}

/**
 * Handler principal
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, persona, messages, lang, woofsRemaining } = await req.json();

    if (!brandId || !persona || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandId, persona, messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer les informations de la marque (niche, voice)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    let brandContext: { niche?: string; voice?: string } | undefined;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const brandResponse = await fetch(`${SUPABASE_URL}/rest/v1/brands?id=eq.${brandId}&select=niche,voice`, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        
        if (brandResponse.ok) {
          const brands = await brandResponse.json();
          if (brands && brands.length > 0) {
            brandContext = {
              niche: brands[0].niche,
              voice: brands[0].voice
            };
          }
        }
      } catch (error) {
        console.warn("Could not fetch brand context:", error);
      }
    }

    // Sélectionner le system prompt selon la persona
    const systemPrompt = SYSTEM_PROMPTS[persona as keyof typeof SYSTEM_PROMPTS];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Invalid persona: ${persona}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Appeler le LLM avec le contexte de marque et Woofs
    const rawReply = await callLLM(messages, systemPrompt, brandContext, woofsRemaining);

    // Parser le pack si présent
    const pack = parsePack(rawReply);
    const reply = cleanReply(rawReply);

    return new Response(
      JSON.stringify({ reply, pack }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("alfie-chat-widget error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
