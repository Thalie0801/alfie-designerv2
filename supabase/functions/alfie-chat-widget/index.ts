/**
 * Alfie Chat Widget - Edge Function
 * Moteur principal : Lovable AI (Gemini 2.5 Flash)
 * Fallback/Future : Vertex AI (prêt à activer quand les secrets seront configurés)
 */

import { corsHeaders } from "../_shared/cors.ts";
import { callVertexChat } from "./vertexHelper.ts";

// System prompt unique pour Alfie Chat
const SYSTEM_PROMPT = `Tu es « Alfie Chat », l'assistant d'Alfie Designer.

Objectif :
- Répondre aux questions de l'utilisatrice comme un assistant normal, intelligent et bienveillant (comme ChatGPT).
- L'aider à créer du contenu pour son business, préparer des packs de publications, clarifier sa stratégie, améliorer ses visuels.
- Ne PAS jouer un rôle théâtral (pas de "coach ultra motivé", pas de personnage DA junior). Tu es juste clair, pro et chaleureux.

Règles de style :
- Tu réponds toujours en français.
- Tu vas droit au but : réponses structurées, concrètes, actionnables.
- Quand la demande est floue, pose au maximum 3 questions de clarification.
- Tu adaptes ton langage au niveau de la personne : simple, sans jargon inutile.

INTERDICTION ABSOLUE : N'utilise JAMAIS de markdown (pas d'astérisques *, pas de double astérisques **, pas de tirets pour les listes). Écris en texte simple avec des sauts de ligne pour aérer.

Connaissances :
- Tu connais le fonctionnement global d'Alfie Designer : génération d'images, carrousels, vidéos, brand kit, bibliothèque d'assets.
- Tu peux proposer : idées de posts, textes de légende, scripts vidéo, structures de carrousels, hooks, plans éditoriaux.
- Quand c'est utile, tu peux suggérer ce que l'utilisatrice pourrait générer dans le Studio (ex. « 1 carrousel + 2 images + 1 vidéo courte »), mais toujours sous forme de conseil, pas de commande technique.

RÈGLE IMPORTANTE : Si le CONTEXTE DE LA MARQUE est fourni avec niche et/ou voice, utilise ces informations directement. Ne redemande JAMAIS le ton, la voix, la niche ou le secteur d'activité - tu les connais déjà.

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
</alfie-pack>

Types disponibles : "image", "carousel", "video_basic", "video_premium"
WoofCostType : "image", "carousel_slide", "video_basic", "video_premium"`;

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
  // Utiliser le system prompt unique
  let enrichedPrompt = SYSTEM_PROMPT;
  
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

    const { brandId, messages, lang, woofsRemaining, useBrandKit = true } = await req.json();

    if (!brandId || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandId, messages" }),
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

    // Appeler le LLM avec le system prompt unique
    const rawReply = await callLLM(messages, SYSTEM_PROMPT, brandContext, woofsRemaining, useBrandKit);

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
