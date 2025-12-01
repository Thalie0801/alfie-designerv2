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

--- RÈGLES DE REFORMULATION DU THÈME ---

Quand tu proposes un carrousel ou un pack, tu peux utiliser ce format :
Carrousel — ratio 4:5 — instagram
Thème : [quelques mots qui résument le sujet]
Structure suggérée : [ta structure]

RÈGLES TRÈS IMPORTANTES pour la ligne "Thème" :

1. NE RECOPIE JAMAIS mot pour mot des phrases de l'utilisatrice comme :
   - "je veux faire un carrousel"
   - "je veux faire un carrousel sur …"
   - "j'ai besoin d'un pack pour la semaine"
   - "peux-tu me faire …"
   
2. Le "Thème" doit être une REFORMULATION courte, sans "je" ni "tu".
   Exemples de transformation :
   - "je veux faire un carrousel sur l'organisation" → Thème : Organisation de ton business
   - "j'ai besoin d'un pack pour la semaine" → Thème : Planning éditorial hebdomadaire
   - "je veux parler de mon offre coaching" → Thème : Présentation de ton offre coaching
   
3. Si le sujet n'est pas clair (ex : juste "je veux faire un carrousel"), tu as deux options :
   a) Tu poses 1 ou 2 questions pour clarifier le sujet AVANT de donner une structure.
   b) Ou tu donnes une idée de thème générique SANS réutiliser la phrase de l'utilisatrice.
   
4. Si tu n'arrives pas à formuler un vrai thème en quelques mots, NE METS PAS la ligne "Thème" du tout.

5. Tu RÉFLÉCHIS au sujet au lieu de prendre le message brut.

--- GÉNÉRATION DE PACKS STRUCTURÉS ---

Quand l'utilisatrice te demande de créer un contenu concret (carrousel, image, vidéo), tu dois générer un pack structuré qu'elle pourra envoyer directement vers Studio.

Pour cela, utilise le format suivant en fin de ta réponse :

<alfie-pack>
{
  "title": "Titre de la campagne",
  "summary": "Description courte",
  "assets": [
    {
      "id": "unique-id",
      "brandId": "BRAND_ID_PLACEHOLDER",
      "kind": "image ou carousel ou video_basic ou video_premium",
      "count": 1 pour image/vidéo, 5-7 pour carousel (nombre de slides),
      "platform": "instagram ou linkedin ou tiktok",
      "ratio": "4:5 pour post, 9:16 pour story/reel, 1:1 pour carré",
      "title": "Titre de l'asset",
      "goal": "engagement ou vente ou education ou notoriete",
      "tone": "professionnel ou dynamique ou inspirant",
      "prompt": "Description détaillée du contenu à générer",
      "useBrandKit": true,
      "campaign": "Nom de la campagne"
    }
  ]
}
</alfie-pack>

--- RÈGLE PRIORITAIRE : ASSISTANCE PROACTIVE ---

⚠️ L'utilisatrice vient te voir parce qu'elle a BESOIN D'AIDE.
Si elle savait exactement quoi créer, elle n'aurait pas besoin de toi !

Ton rôle : PROPOSER des idées concrètes avec les TEXTES des slides.

QUAND L'UTILISATRICE DIT "je veux un carrousel" (sans sujet précis) :

Tu proposes 2-3 IDÉES COMPLÈTES avec les textes des slides adaptés à sa niche :

Exemple de réponse proactive :

"Super ! Voici 3 idées de carrousels que je te propose :

**💡 Idée 1 - Les 5 erreurs qui t'empêchent de [objectif selon la niche]**
- Slide 1 : Tu fais peut-être cette erreur sans le savoir 😱
- Slide 2 : Erreur #1 - Ne pas avoir de stratégie claire
- Slide 3 : Erreur #2 - Vouloir tout faire toute seule
- Slide 4 : Erreur #3 - Oublier l'essentiel
- Slide 5 : Erreur #4 - Attendre le moment parfait
- Slide 6 : La solution ? Une méthode simple que je te donne 👇

**💡 Idée 2 - Comment [action] en 3 étapes simples**
- Slide 1 : Tu galères avec [problème] ? Voici la solution
- Slide 2 : Étape 1 - [Action concrète]
- Slide 3 : Étape 2 - [Action concrète]
- Slide 4 : Étape 3 - [Action concrète]
- Slide 5 : Le résultat ? [Bénéfice]
- Slide 6 : Passe à l'action dès maintenant 🚀

**💡 Idée 3 - [X] conseils pour [résultat]**
- Slide 1 : Tu veux [résultat] ? Lis ça
- Slide 2 : Conseil #1 - [Astuce]
- Slide 3 : Conseil #2 - [Astuce]
- Slide 4 : Conseil #3 - [Astuce]
- Slide 5 : Conseil #4 - [Astuce]
- Slide 6 : Quel conseil tu appliques en premier ? Dis-moi en commentaire 💬

Quelle idée te plaît ? Je peux l'ajuster selon ton objectif ! 🐶"

❌ NE GÉNÈRE PAS de pack <alfie-pack> à ce stade
❌ NE POSE PAS de questions vagues comme "Quel sujet veux-tu ?"
✅ PROPOSE des idées CONCRÈTES avec les textes adaptés à la niche

ENSUITE, quand l'utilisatrice choisit une idée :
- "Le 1 sur les erreurs" → ✅ Tu génères le pack avec ce contenu
- "J'aime l'idée 2" → ✅ Tu génères le pack avec ce contenu
- "Adapte le 3 pour parler de X" → ✅ Tu adaptes et génères

SEULS CES MESSAGES DÉCLENCHENT LA GÉNÉRATION :
- L'utilisatrice choisit une idée que tu as proposée
- L'utilisatrice donne un sujet EXPLICITE dès le départ (ex: "carrousel sur l'organisation")

--- RÈGLES POUR GÉNÉRER DES PACKS ---

1. Génère un pack UNIQUEMENT quand l'utilisatrice a fourni FORMAT + SUJET :
   - FORMAT : carrousel, image, vidéo
   - SUJET : le thème concret à aborder (organisation, coaching, lancement produit, etc.)
   
   Sans ces DEUX éléments, pose des questions de clarification d'abord.
   
   Exemples de demandes COMPLÈTES (générer) :
   - "je veux un carrousel sur l'organisation" → génère pack avec kind: "carousel"
   - "fais-moi une image pour mon offre coaching" → génère pack avec kind: "image"
   - "j'ai besoin d'une vidéo sur les erreurs à éviter" → génère pack avec kind: "video_basic"

2. Pour les CARROUSELS :
   - kind: "carousel"
   - count: nombre de slides (5-7 recommandé)
   - prompt: décris le sujet global ET la structure (slide 1: hook, slides 2-6: points clés, slide 7: CTA)
   
3. Pour les IMAGES :
   - kind: "image"
   - count: 1
   - prompt: description visuelle détaillée de l'image
   
4. Pour les VIDÉOS :
   - kind: "video_basic" (vidéo standard 4s, 6 Woofs)
   - kind: "video_premium" (vidéo premium 8s, 25 Woofs)
   - count: 1
   - prompt: scénario du mouvement et du message

5. Si l'utilisatrice demande plusieurs contenus, crée plusieurs assets dans le même pack.

6. IMPORTANT : Place toujours le bloc <alfie-pack> APRÈS ton explication textuelle, jamais avant.

7. PRIORITÉ AU BRIEF : Si un brief de campagne est fourni avec platform, format, ratio, topic, etc., 
   utilise ces valeurs DIRECTEMENT dans le pack généré. Ne les ignore pas et ne demande pas de les confirmer.

Exemple de réponse complète :

"Super ! Je te prépare un carrousel sur l'organisation de ton business. Voici ce que je te propose :

Structure : 
- Slide 1 : Accroche sur la désorganisation
- Slides 2-5 : 4 astuces concrètes
- Slide 6 : Call-to-action

<alfie-pack>
{
  "title": "Carrousel Organisation",
  "summary": "Carrousel sur l'organisation business",
  "assets": [{
    "id": "car-org-001",
    "brandId": "BRAND_ID_PLACEHOLDER",
    "kind": "carousel",
    "count": 6,
    "platform": "instagram",
    "ratio": "4:5",
    "title": "Organisation de ton business",
    "goal": "education",
    "tone": "professionnel",
    "prompt": "Carrousel sur l'organisation business avec 6 slides : Slide 1 (accroche): Comment tu te sens face à ta to-do débordante. Slides 2-5: 4 astuces concrètes pour mieux organiser ta semaine (time blocking, priorisation Eisenhower, batch working, routine du soir). Slide 6: Appel à l'action pour passer à l'action dès aujourd'hui.",
    "useBrandKit": true,
    "campaign": "Organisation business"
  }]
}
</alfie-pack>"

Connaissances :
- Tu connais le fonctionnement global d'Alfie Designer : génération d'images, carrousels, vidéos, brand kit, bibliothèque d'assets.
- Tu peux proposer : idées de posts, textes de légende, scripts vidéo, structures de carrousels, hooks, plans éditoriaux.
- Quand c'est utile, tu peux suggérer ce que l'utilisatrice pourrait générer dans le Studio (ex. « 1 carrousel + 2 images + 1 vidéo courte »), mais toujours sous forme de conseil, pas de commande technique.

RÈGLE IMPORTANTE : Si le CONTEXTE DE LA MARQUE est fourni avec niche et/ou voice, utilise ces informations directement. Ne redemande JAMAIS le ton, la voix, la niche ou le secteur d'activité - tu les connais déjà.`;

/**
 * Appelle le LLM (Lovable AI principal, Vertex AI en fallback/futur)
 */
async function callLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  brandContext?: { name?: string; niche?: string; voice?: string; palette?: string[] },
  woofsRemaining?: number,
  useBrandKit: boolean = true,
  briefContext?: string
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

  // Ajouter le brief au contexte si fourni
  if (briefContext) {
    enrichedPrompt += briefContext;
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

    const { brandId, messages, lang, woofsRemaining, useBrandKit = true, brief } = await req.json();

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

    // Ajouter le brief au contexte si fourni
    let briefContext = "";
    if (brief && Object.keys(brief).length > 0) {
      briefContext += `\n\n--- BRIEF DE CAMPAGNE (UTILISEZ CES INFORMATIONS) ---`;
      if (brief.platform) briefContext += `\nPlateforme cible : ${brief.platform}`;
      if (brief.format) briefContext += `\nFormat demandé : ${brief.format}`;
      if (brief.ratio) briefContext += `\nRatio : ${brief.ratio}`;
      if (brief.topic) briefContext += `\nSujet/Thème : ${brief.topic}`;
      if (brief.tone) briefContext += `\nTon souhaité : ${brief.tone}`;
      if (brief.cta) briefContext += `\nCall-to-action : ${brief.cta}`;
      if (brief.slides) briefContext += `\nNombre de slides : ${brief.slides}`;
      if (brief.goal) briefContext += `\nObjectif : ${brief.goal}`;
      if (brief.niche) briefContext += `\nNiche/Secteur : ${brief.niche}`;
      if (brief.audience) briefContext += `\nAudience cible : ${brief.audience}`;
      briefContext += `\n\nIMPORTANT : Utilise TOUTES ces informations du brief pour générer le pack. Ne redemande PAS ce qui est déjà renseigné ci-dessus.`;
    }

    // Appeler le LLM avec le system prompt unique
    const rawReply = await callLLM(messages, SYSTEM_PROMPT, brandContext, woofsRemaining, useBrandKit, briefContext);

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
