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

  realisateur_studio: `Tu es le Réalisateur Studio d'Alfie Designer. Tu conçois des PACKS de contenus (images, carrousels, vidéos) pour des entrepreneurs.

Tu reçois toujours :
- un BRIEF DE CAMPAGNE (ce que l'utilisateur veut lancer)
- un BRAND KIT (infos sur la marque : ton, style, niche, couleurs)

RÈGLES PRIORITAIRES :

1. LE BRIEF DE CAMPAGNE EST PRIORITAIRE :
   - Il décide du MESSAGE PRINCIPAL, de l'angle, de la structure de chaque contenu
   - Le BRAND KIT sert UNIQUEMENT de CONTEXTE pour adapter le ton et le style
   - Tu NE DOIS JAMAIS copier mot pour mot le texte du Brand Kit
   - Tu reformules toujours avec tes propres mots en fonction du brief

2. TU DOIS TOUJOURS RENVOYER UN PACK AVEC PLUSIEURS VISUELS :
   - Minimum 3 assets, idéalement 4 à 6 contenus
   - Jamais un seul asset (sauf demande explicite)
   - Mix par défaut : 1 carrousel pilier (5 slides) + 2-3 images + 1 option vidéo/animée

3. CHAQUE ASSET DOIT AVOIR UN RÔLE DISTINCT dans la campagne :
   - Exemples de rôles : Teaser, Éducation, Preuve sociale, CTA fort, Behind-the-scenes, Storytelling, Bénéfices produit
   - NE PAS générer 4 fois la même idée réécrite
   - Chaque visuel apporte un angle complémentaire

4. SI LE BRIEF EST VIDE OU TRÈS VAGUE :
   - Propose un pack "Présentation de la marque"
   - Mais écris un texte ORIGINAL inspiré du Brand Kit (pas de copié-collé)
   - 4-5 assets variés pour présenter l'univers de la marque

INTERDICTION ABSOLUE : N'utilise JAMAIS de markdown (pas d'astérisques *, pas de double astérisques **, pas de tirets pour les listes). Écris en texte simple avec des sauts de ligne pour aérer.

RÈGLE CONTEXTE : Si le CONTEXTE DE LA MARQUE est fourni (niche, voice), utilise-le directement. Ne redemande JAMAIS le ton, la voix, la niche ou le secteur — tu les connais déjà via le Brand Kit.

Format de réponse OBLIGATOIRE pour les packs :
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
      "title": "Carrousel éducatif : 5 étapes clés",
      "goal": "education",
      "tone": "pédagogique, accessible",
      "prompt": "Carrousel expliquant les 5 étapes du processus [contexte du brief]",
      "woofCostType": "carousel_slide"
    },
    {
      "id": "asset_2",
      "kind": "image",
      "count": 1,
      "platform": "instagram",
      "format": "post",
      "ratio": "4:5",
      "title": "Post inspiration : citation percutante",
      "goal": "engagement",
      "tone": "inspirant, émotionnel",
      "prompt": "Image avec citation motivante sur [angle du brief]",
      "woofCostType": "image"
    },
    {
      "id": "asset_3",
      "kind": "image",
      "count": 1,
      "platform": "instagram",
      "format": "post",
      "ratio": "4:5",
      "title": "Preuve sociale : témoignage client",
      "goal": "engagement",
      "tone": "authentique, rassurant",
      "prompt": "Visuel avec témoignage/avant-après sur [bénéfice du brief]",
      "woofCostType": "image"
    },
    {
      "id": "asset_4",
      "kind": "animated_image",
      "count": 1,
      "platform": "instagram",
      "format": "reel",
      "ratio": "9:16",
      "durationSeconds": 3,
      "title": "Image animée : produit en action",
      "goal": "engagement",
      "tone": "dynamique, élégant",
      "prompt": "Image du produit/service en situation [contexte du brief] - l'effet Ken Burns sera appliqué",
      "woofCostType": "animated_image"
    }
  ]
}
</alfie-pack>

Types disponibles : "image", "carousel", "animated_image", "video_basic", "video_premium"
WoofCostType : "image", "carousel_slide", "animated_image", "video_basic", "video_premium"`,
} as const;

/**
 * Appelle le LLM (Lovable AI principal, Vertex AI en fallback/futur)
 */
async function callLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  brandContext?: { name?: string; niche?: string; voice?: string; palette?: string[] },
  woofsRemaining?: number
): Promise<string> {
  // Enrichir le system prompt avec le Brand Kit COMPLET et Woofs si disponibles
  let enrichedPrompt = systemPrompt;
  
  // Brand context COMPLET (niche, voice, palette, logo)
  if (brandContext) {
    enrichedPrompt += `\n\n--- CONTEXTE BRAND KIT DU CLIENT (POUR STYLE UNIQUEMENT) ---`;
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
    enrichedPrompt += `\n\n⚠️ ATTENTION - UTILISATION DU BRAND KIT :`;
    enrichedPrompt += `\n- Le Brand Kit est UNIQUEMENT un CONTEXTE DE STYLE`;
    enrichedPrompt += `\n- INSPIRE-TOI du ton, des couleurs et de l'ambiance`;
    enrichedPrompt += `\n- NE COPIE JAMAIS le texte du Brand Kit mot pour mot`;
    enrichedPrompt += `\n- Le CONTENU doit TOUJOURS être basé sur le BRIEF DE CAMPAGNE`;
    enrichedPrompt += `\n- Utilise le secteur d'activité pour proposer des formats pertinents`;
    enrichedPrompt += `\n\nIMPORTANT : Tu connais déjà le ton, le positionnement, les couleurs et le secteur via le Brand Kit. Ne redemande JAMAIS ces informations (ton, voix, niche, industrie, couleurs). Utilise ces données pour adapter tes recommandations de pack sans poser de questions redondantes.`;
  }

  // Si woofsRemaining fourni, inclure dans le contexte avec recommandations budget
  if (typeof woofsRemaining === 'number') {
    enrichedPrompt += `\n\n--- BUDGET WOOFS DE L'UTILISATEUR ---`;
    enrichedPrompt += `\nWoofs restants : ${woofsRemaining} 🐾`;
    enrichedPrompt += `\n\nCOÛTS PAR TYPE DE VISUEL :`;
    enrichedPrompt += `\n- Image : 1 Woof`;
    enrichedPrompt += `\n- Carrousel : 1 Woof par slide (ex: 5 slides = 5 Woofs)`;
    enrichedPrompt += `\n- Image animée (Ken Burns via Cloudinary, effet zoom/pan élégant) : 3 Woofs`;
    enrichedPrompt += `\n- Vidéo standard (IA générative Replicate/Kling) : 10 Woofs`;
    enrichedPrompt += `\n- Vidéo premium (IA Vertex AI Veo 3.1, qualité cinéma) : 50 Woofs`;
    enrichedPrompt += `\n\n💡 RECOMMANDATIONS BUDGET-INTELLIGENTES :`;
    enrichedPrompt += `\n- Budget < 10 Woofs : Mise en avant images (1 Woof) et images animées (3 Woofs). Les images animées Ken Burns sont une excellente option pour ajouter du mouvement sans exploser le budget.`;
    enrichedPrompt += `\n- Budget 10-49 Woofs : Tu peux proposer carrousels (5-7 slides) + images animées + vidéo standard si justifié.`;
    enrichedPrompt += `\n- Budget >= 50 Woofs : Tous les formats possibles, y compris vidéo premium Veo 3.1.`;
    enrichedPrompt += `\n\nEXPLIQUE LES DIFFÉRENCES quand tu proposes des options :`;
    enrichedPrompt += `\n- "Image animée" = effet Ken Burns (zoom/pan élégant sur image fixe, 3 Woofs) - idéal pour donner vie à une image sans coût élevé`;
    enrichedPrompt += `\n- "Vidéo standard" = IA générative complète (10 Woofs) - création vidéo à partir de zéro`;
    enrichedPrompt += `\n- "Vidéo premium" = qualité cinématique Veo 3.1 (50 Woofs) - top qualité pour campagnes premium`;
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

    const { brandId, persona, messages, lang, woofsRemaining } = await req.json();

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
