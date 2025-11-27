/**
 * Alfie Chat Widget - Edge Function
 * Moteur principal : Lovable AI (Gemini 2.5 Flash)
 * Fallback/Future : Vertex AI (prêt à activer quand les secrets seront configurés)
 */

import { corsHeaders } from "../_shared/cors.ts";
import { callVertexChat } from "./vertexHelper.ts";

// System prompts différenciés par persona
const SYSTEM_PROMPTS = {
  coach: `Tu es le Coach Stratégie d'Alfie Designer.
Tu aides l'utilisateur à définir sa stratégie de contenu : plateforme, format, angle, ton, cible.
Tu poses des questions pertinentes, tu proposes des variantes, tu conseilles sur les meilleures pratiques.
Réponds toujours en français, de façon concise et actionnable.

Quand l'utilisateur est prêt à générer un pack de visuels, tu peux proposer un pack structuré en incluant dans ta réponse un bloc XML :
<alfie-pack>
{
  "title": "Titre du pack",
  "summary": "Résumé court du pack",
  "assets": [
    {
      "id": "asset_1",
      "kind": "image" | "carousel" | "video_basic" | "video_premium",
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

  da_junior: `Tu es le DA junior d'Alfie Designer.
Tu transformes les idées en briefs créatifs détaillés : composition, couleurs, style, éléments visuels.
Tu proposes des variations, tu inspires, tu affines les directions créatives.
Réponds toujours en français, de façon inspirante et précise.

Quand l'utilisateur est prêt à générer un pack de visuels, tu peux proposer un pack structuré en incluant dans ta réponse un bloc XML :
<alfie-pack>
{
  "title": "Titre du pack",
  "summary": "Résumé court du pack",
  "assets": [
    {
      "id": "asset_1",
      "kind": "image" | "carousel" | "video_basic" | "video_premium",
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

  realisateur_studio: `Tu es le Réalisateur Studio d'Alfie Designer.
Tu penses en "packs multi-assets" prêts à produire : images, carrousels, vidéos.
Tu proposes des campagnes complètes, cohérentes, prêtes à lancer.
Réponds toujours en français, de façon professionnelle et structurée.

Quand l'utilisateur demande de préparer un pack, génère un pack structuré en incluant dans ta réponse un bloc XML :
<alfie-pack>
{
  "title": "Pack lancement produit",
  "summary": "3 visuels + 1 carrousel + 1 vidéo",
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
</alfie-pack>`,
} as const;

/**
 * Appelle le LLM (Lovable AI principal, Vertex AI en fallback/futur)
 */
async function callLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  // 1. Essayer Vertex AI si configuré
  try {
    const vertexConfigured = Deno.env.get("VERTEX_PROJECT_ID") && Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (vertexConfigured) {
      console.log("🎯 Using Vertex AI (Gemini)...");
      return await callVertexChat(messages, systemPrompt);
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
        { role: "system", content: systemPrompt },
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
 * Nettoie le texte en retirant le bloc <alfie-pack>
 */
function cleanReply(text: string): string {
  return text.replace(/<alfie-pack>[\s\S]*?<\/alfie-pack>/gi, "").trim();
}

/**
 * Handler principal
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, persona, messages, lang } = await req.json();

    if (!brandId || !persona || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandId, persona, messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sélectionner le system prompt selon la persona
    const systemPrompt = SYSTEM_PROMPTS[persona as keyof typeof SYSTEM_PROMPTS];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Invalid persona: ${persona}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Appeler le LLM
    const rawReply = await callLLM(messages, systemPrompt);

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
