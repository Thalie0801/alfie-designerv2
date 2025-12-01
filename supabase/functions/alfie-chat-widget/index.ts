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

  realisateur_studio: `Tu es "Alfie – Réalisateur Studio".

RÔLE
- Tu aides l'utilisatrice à transformer ses idées en VISUELS prêts à produire dans le Studio.
- Tu réponds toujours en français, de manière claire, courte, professionnelle mais chaleureuse.

FORMAT DE RÉPONSE QUAND LE SUJET EST CLAIR
Ta réponse tient en un seul bloc :

Prêt à produire — [une phrase très courte qui rassure]

Visuel hook : [titre reformulé, accroche claire, max 7–8 mots, SANS utiliser "je", "j'ai besoin", "j'aimerais"…]
Fond : [1 phrase sur le fond / ambiance / couleurs]
Cible : [résumer la cible en 1 ligne]
CTA : [1 seule phrase courte pour la légende]

Puis tu proposes le pack structuré en <alfie-pack>...</alfie-pack>.

RÈGLES CRITIQUES — INTERDICTIONS ABSOLUES

1. NE RECOPIE JAMAIS mot pour mot une phrase comme :
   - "j'ai besoin d'un pack pour la semaine"
   - "j'ai besoin d'idées"
   - "je ne sais pas quoi poster"
   - ou toute phrase qui commence par "je / j'…"
   Ces phrases décrivent le BESOIN de l'utilisatrice, pas le texte du visuel.

2. Tu dois TOUJOURS reformuler le hook en langage orienté bénéfice pour l'audience.
   Exemple : "j'ai besoin d'un pack pour la semaine" → "Ton planning de contenu prêt pour la semaine"

3. N'utilise JAMAIS de markdown (pas d'astérisques *, **, pas de tirets listes). Texte simple uniquement.

QUAND LA DEMANDE EST FLOUE OU "MÉTA"

Si la demande est floue, trop large, ou "méta" (pack, planning, idées, stratégie, semaine, etc.) :

1. Tu ne donnes PAS encore de visuel hook ni de pack.
2. Tu réponds avec 2 à 3 questions maximum pour préciser :
   - Réseau principal (Instagram, TikTok, LinkedIn, Pinterest…)
   - Sujet / offre principale à mettre en avant cette semaine
   - Objectif (visibilité, vente, prise de rendez-vous…)
3. Tu attends les réponses AVANT de proposer des hooks ou un pack.

Exemple de réponse pour "j'ai besoin d'un pack pour la semaine" :

Prêt à produire — on va te préparer ton pack semaine.

Avant de te proposer les visuels, j'ai besoin de préciser :

1. Tu veux des contenus pour quel réseau principal ?
2. On met en avant quelle offre / thématique cette semaine ?
3. Ton objectif principal : visibilité, ventes, rendez-vous… ?

QUAND TU PROPOSES UN PACK

- Tu restes focalisé sur ce qui sera PRODUIT dans le Studio : image, carrousel, vidéo courte.
- Minimum 3 assets, idéalement 4 à 6 contenus variés.
- Chaque asset a un rôle distinct (Teaser, Éducation, Preuve sociale, CTA fort, Storytelling…).

Format obligatoire pour les packs :
<alfie-pack>
{
  "title": "Nom du pack",
  "summary": "Résumé : 1 carrousel + 2 images + 1 vidéo",
  "assets": [
    {
      "id": "asset_1",
      "kind": "carousel",
      "count": 5,
      "platform": "instagram",
      "format": "post",
      "ratio": "4:5",
      "title": "Titre accrocheur reformulé",
      "goal": "education",
      "tone": "pédagogique, accessible",
      "prompt": "Description détaillée pour la génération",
      "woofCostType": "carousel_slide"
    },
    {
      "id": "asset_2",
      "kind": "image",
      "count": 1,
      "platform": "instagram",
      "format": "post",
      "ratio": "9:16",
      "title": "Titre de l'image reformulé",
      "goal": "engagement",
      "tone": "premium",
      "prompt": "Description visuelle de l'image",
      "woofCostType": "image"
    },
    {
      "id": "asset_3",
      "kind": "video_basic",
      "count": 1,
      "platform": "instagram",
      "format": "reel",
      "ratio": "9:16",
      "title": "Titre de la vidéo reformulé",
      "goal": "engagement",
      "tone": "friendly",
      "prompt": "Description du mouvement et de la scène vidéo",
      "durationSeconds": 4,
      "woofCostType": "video_basic"
    }
  ]
}
</alfie-pack>

Types disponibles : "image", "carousel", "video_basic", "video_premium"
WoofCostType : "image", "carousel_slide", "video_basic", "video_premium"`,
} as const;

/**
 * Appelle le LLM (Lovable AI principal, Vertex AI en fallback/futur)
 */
async function callLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  brandContext?: { name?: string; niche?: string; voice?: string; palette?: string[] },
  woofsRemaining?: number,
  useBrandKit: boolean = true
): Promise<string> {
  // Enrichir le system prompt avec les RÈGLES DE PRIORITÉ BRIEF > BRAND KIT
  let enrichedPrompt = systemPrompt;
  
  // RÈGLES DE PRIORITÉ BRIEF > BRAND KIT
  enrichedPrompt += `\n\n--- RÈGLES D'UTILISATION DU BRIEF ET DU BRAND KIT ---
  
1. Le BRIEF DE CAMPAGNE est TOUJOURS prioritaire.
   - S'il y a un conflit entre le brief et le brand kit, tu suis le BRIEF.
   - Le contenu, l'angle, le message principal viennent du BRIEF.

2. Si [BRAND_KIT_ENABLED] = true :
   - Tu utilises le Brand Kit pour adapter le ton de voix, le style des visuels, les références à la marque.
   - Mais tu restes aligné avec l'objectif précis du brief (offre, cible, plateforme…).
   - Tu ne COPIES JAMAIS mot pour mot le texte du Brand Kit.

3. Si [BRAND_KIT_ENABLED] = false :
   - Tu ne réutilises PAS le storytelling, les slogans ou le style du Brand Kit.
   - Tu peux éventuellement déduire le type de business pour rester cohérent.
   - Tu écris des textes neutres/génériques, alignés sur le brief uniquement.

4. CAS BRIEF VIDE OU TRÈS VAGUE :
   - Si le brief est vide ou ne donne presque aucune info exploitable, tu crées un pack "Présentation de la marque".
   - Ce pack doit contenir AU MINIMUM : 1 carrousel découverte (5 slides), 1 image citation/valeur, 1 image promesse/bénéfice, 1 idée vidéo "Qui sommes-nous ?".
   - Tu t'inspires du Brand Kit mais tu reformules ENTIÈREMENT avec tes mots.`;

  // INDICATEUR BRAND_KIT_ENABLED
  enrichedPrompt += `\n\n[BRAND_KIT_ENABLED]\n${useBrandKit}`;
  
  // BRAND KIT CONTEXT (filtré selon useBrandKit)
  if (brandContext) {
    enrichedPrompt += `\n\n[BRAND_KIT]`;
    
    if (useBrandKit) {
      // Mode complet : tout le Brand Kit
      if (brandContext.name) {
        enrichedPrompt += `\nNom de la marque : ${brandContext.name}`;
      }
      if (brandContext.niche) {
        enrichedPrompt += `\nSecteur d'activité : ${brandContext.niche}`;
      }
      if (brandContext.voice) {
        enrichedPrompt += `\nTon de la marque : ${brandContext.voice}`;
      }
      if (brandContext.palette && Array.isArray(brandContext.palette) && brandContext.palette.length > 0) {
        enrichedPrompt += `\nCouleurs de la marque : ${brandContext.palette.slice(0, 5).join(", ")}`;
      }
      enrichedPrompt += `\n\nIMPORTANT : Tu connais déjà le ton, le positionnement, les couleurs et le secteur via le Brand Kit. Ne redemande JAMAIS ces informations (ton, voix, niche, industrie, couleurs). Utilise ces données pour adapter tes recommandations de pack sans poser de questions redondantes.`;
    } else {
      // Mode neutre : secteur uniquement
      if (brandContext.niche) {
        enrichedPrompt += `\nSecteur d'activité : ${brandContext.niche}`;
      }
      enrichedPrompt += `\n\n⚠️ RÈGLE ABSOLUE : L'utilisateur a EXPLICITEMENT DÉSACTIVÉ le Brand Kit.
Tu NE DOIS PAS :
- Reprendre le ton de voix, le style ou les couleurs de la marque
- Utiliser des mascottes, personnages ou éléments narratifs du Brand Kit
- Faire référence à l'identité de marque

Tu DOIS créer des visuels GÉNÉRIQUES et NEUTRES basés UNIQUEMENT sur le brief de campagne.
Le secteur d'activité est fourni pour contexte minimal, mais reste neutre dans ton approche créative.`;
    }
  }

  // Si woofsRemaining fourni, inclure dans le contexte avec recommandations budget
  if (typeof woofsRemaining === 'number') {
    enrichedPrompt += `\n\n--- BUDGET WOOFS DE L'UTILISATEUR ---`;
    enrichedPrompt += `\nWoofs restants : ${woofsRemaining}`;
    enrichedPrompt += `\n\nCOUTS PAR TYPE DE VISUEL :`;
    enrichedPrompt += `\n- Image : 1 Woof`;
    enrichedPrompt += `\n- Carrousel : 1 Woof par slide (ex: 5 slides = 5 Woofs)`;
    enrichedPrompt += `\n- Video standard (IA generative Replicate) : 10 Woofs`;
    enrichedPrompt += `\n- Video premium (IA Vertex AI Veo 3.1, qualite cinema) : 50 Woofs`;
    enrichedPrompt += `\n\nRECOMMANDATIONS BUDGET-INTELLIGENTES :`;
    enrichedPrompt += `\n- Budget < 10 Woofs : Mise en avant images (1 Woof) et carrousels.`;
    enrichedPrompt += `\n- Budget 10-49 Woofs : Tu peux proposer carrousels (5-7 slides) + video standard si justifie.`;
    enrichedPrompt += `\n- Budget >= 50 Woofs : Tous les formats possibles, y compris video premium Veo 3.1.`;
    enrichedPrompt += `\n\nEXPLIQUE LES DIFFERENCES quand tu proposes des options :`;
    enrichedPrompt += `\n- "Video standard" = IA generative complete Replicate (10 Woofs) - creation video a partir de zero`;
    enrichedPrompt += `\n- "Video premium" = qualite cinematique Veo 3.1 (50 Woofs) - top qualite pour campagnes premium`;
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
    // ✅ VALIDATION JWT (activé dans config.toml)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { brandId, persona, messages, lang, woofsRemaining, useBrandKit = true } = await req.json();

    if (!brandId || !persona || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandId, persona, messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer le Brand Kit COMPLET de la marque (palette, niche, voice, name)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    let brandContext: { name?: string; niche?: string; voice?: string; palette?: string[] } | undefined;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        // ✅ VALIDATION PROPRIÉTÉ DE LA MARQUE
        const supabaseAuth = await import("https://esm.sh/@supabase/supabase-js@2.57.2").then(mod => mod.createClient);
        const supabase = supabaseAuth(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          return new Response(
            JSON.stringify({ error: "Token invalide" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Vérifier que l'utilisateur possède la brand
        const brandResponse = await fetch(`${SUPABASE_URL}/rest/v1/brands?id=eq.${brandId}&select=user_id,name,niche,voice,palette`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': authHeader
          }
        });
        
        if (brandResponse.ok) {
          const brands = await brandResponse.json();
          if (brands && brands.length > 0) {
            if (brands[0].user_id !== user.id) {
              return new Response(
                JSON.stringify({ error: "Accès non autorisé à cette marque" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            brandContext = {
              niche: brands[0].niche,
              voice: brands[0].voice
            };
          } else {
            return new Response(
              JSON.stringify({ error: "Marque introuvable" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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

    // Appeler le LLM avec le contexte de marque, Woofs et toggle Brand Kit
    const rawReply = await callLLM(messages, systemPrompt, brandContext, woofsRemaining, useBrandKit);

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
