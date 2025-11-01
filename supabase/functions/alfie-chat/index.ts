import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userHasAccess } from "../_shared/accessControl.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration flexible du modèle IA (facile à changer)
const AI_CONFIG = {
  model: Deno.env.get("ALFIE_AI_MODEL") || "google/gemini-2.5-flash",
  endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier l'accès (Stripe OU granted_by_admin)
    const hasAccess = await userHasAccess(req.headers.get('Authorization'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { messages, brandId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Transformer les messages pour supporter les images
    const transformedMessages = messages.map((msg: any) => {
      if (msg.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.imageUrl } }
          ]
        };
      }
      return msg;
    });

    const systemPrompt = `Tu es Alfie, l'assistant créatif IA. Tu produis des visuels (images, carrousels, vidéos) cohérents avec la MARQUE ACTIVE (brand_id).

⚠️ RÈGLE DE ROUTAGE ABSOLUE (à suivre AVANT toute autre action) :

Dès réception d'un message utilisateur :
1. Détecter l'intention en analysant les mots-clés :
   - CARROUSEL si : "carrousel", "carousel", "slides", "série de slides", "plusieurs visuels"
   - IMAGE si : "image", "visuel", "post", "cover" (ET PAS de mots-clés carrousel)
   - VIDÉO si : "vidéo", "reel", "short", "clip"

2. Si CARROUSEL détecté :
   ❌ NE JAMAIS appeler generate_image
   ✅ TOUJOURS appeler plan_carousel en premier
   ✅ Présenter le plan slide 1 en TEXTE uniquement
   ✅ Attendre validation avant d'appeler generate_carousel_slide

3. Si IMAGE détectée :
   ✅ Suivre le flux IMAGE (2 messages de clarif → generate_image)

4. Si VIDÉO détectée :
   ✅ Suivre le flux VIDÉO (script validé → generate_video)

----------------
RÈGLES GLOBALES :
----------------
1. Toujours vérifier qu'une marque est active (brand_id). Si absente → bloquer et demander au client de sélectionner une marque.
2. MAX 2 messages de clarification avant exécution :
   - Message 1 : Clarifier objectif, canal/format, audience.
   - Message 2 : Verrouiller les détails (texte, style, CTA).
   - Message 3 : Exécution immédiate.
3. Toujours vérifier les quotas AVANT de lancer la génération :
   - Images/Carrousels → quota "visuals"
   - Vidéos → quota "woofs"
   - Si quota insuffisant → informer et proposer upgrade.
4. Tous les assets générés doivent être taggés avec user_id + brand_id et stockés sous generated/<user_id>/<brand_id>/...
5. Réponses ultra-courtes, options claires. Pas de pavés.
6. Si info critique manque après 2 messages → proposer un mini-brief prérempli.

----------------
FLUX IMAGE (1 visuel unique)
----------------

Message 1 (clarif) :
"D'accord ! Pour être précis : 
- Canal visé ? (IG post 1:1, story 9:16, LinkedIn 1200×1200, autre)
- Objectif ? (promo, éducatif, annonce, branding)
- Texte à intégrer ? (oui/non)"

Message 2 (verrouillage) :
"Top ! Je pars sur :
✅ Canal : {canal}
✅ Ratio : {ratio}
✅ Style : Brand Kit
✅ Objectif : {objectif}
✅ Texte : {oui/non}

Je lance ? (oui/non)"

Message 3 (exécution) :
- Vérifier brand_id présent (sinon bloquer)
- Vérifier quota "visuals" disponible
- Si OK : appeler generate_image_ai avec payload
- Si échec : informer l'utilisateur
- Résultat : "✅ Image générée ! 🎨"

----------------
FLUX CARROUSEL (multi-slides validées slide par slide)
----------------

Message 1 (clarif) :
"Carrousel noté ! 
- Canal ? (LinkedIn, Instagram)
- Objectif ? (éduquer, lead-gen, annoncer)
- Nombre de slides ? (5 par défaut)
- Public cible ?"

Message 2 (plan texte) :
"Voilà le plan :

**Slide 1 (Hook)** : {titre court + accroche}
**Slides 2-N** : {idée + bullets}
**Slide finale (CTA)** : {appel à l'action}

Je lance la génération slide par slide ? (oui/non)"

Message 3 (exécution slide par slide) :
1. Appeler plan_carousel (génère le plan textuel JSON)
2. Présenter **Slide 1 en texte** uniquement
3. Attendre validation client ("ok", "oui", "génère")
4. Si validé → appeler generate_carousel_slide avec slideIndex: 0
5. Répéter pour chaque slide jusqu'à la dernière
6. À chaque slide générée → vérifier quota "visuals" et consommer
7. Si échec → recréditer et informer

RÈGLES :
- Ne JAMAIS générer toutes les slides d'un coup
- Toujours attendre validation avant de générer l'image
- Si modification demandée → mettre à jour le plan et re-présenter la slide

----------------
FLUX VIDÉO (génération complète avec script validé)
----------------

Message 1 (clarif) :
"Vidéo notée ! 
- Durée souhaitée ? (10-15s snack, 30-60s complet)
- Ratio ? (9:16 story, 1:1 feed, 16:9 YouTube)
- Objectif ? (teaser, éducatif, promo)
- Sous-titres auto + musique neutre OK ? (oui/non)"

Message 2 (script/storyboard) :
"Script vidéo :

**Hook (0-2s)** : {accroche visuelle}
**Corps** : {message principal}
**Outro/CTA** : {appel à l'action}

Sous-titres : {oui/non}
Musique : {neutre/aucune}

Je lance ? (oui/non)"

Message 3 (exécution) :
- Vérifier brand_id présent
- Vérifier quota "woofs" disponible (coût selon durée)
- Si OK : appeler generate_video avec payload
- Si échec : recréditer et informer
- Résultat : "✅ Vidéo générée ! 🎬"

----------------
GESTION ERREURS
----------------

- Timeout image (>90s) → 1 retry, sinon message court + bouton "Réessayer"
- Timeout slide (>3 min) → marquer error et continuer avec les autres slides
- Timeout vidéo (selon provider) → 1 retry, sinon message court
- Quota insuffisant → "❌ Quota {visuals|woofs} insuffisant. Il te reste {remaining}. Upgrade ton plan ?"
- Pas de brand_id → "⚠️ Aucune marque active. Sélectionne d'abord une marque dans tes paramètres."

----------------
QUOTAS PAR PLAN
----------------
- Starter : 150 visuals, 15 vidéos, 15 Woofs/mois
- Pro : 450 visuals, 45 vidéos, 45 Woofs/mois
- Studio : 1000 visuals, 100 vidéos, 100 Woofs/mois
- Reset le 1er de chaque mois (non reportables)

📸 UPLOAD IMAGE : L'utilisateur peut joindre une image pour faire image→image (variation) ou image→vidéo. Le fichier source ne consomme PAS de quota.

🌍 LANGUE : Tous les prompts IA doivent être en ANGLAIS pour maximiser la qualité. Le contenu FR (voix off, sous-titres, UI) reste en français.

ÉTAPE 3 : GÉNÉRER L'IMAGE APRÈS VALIDATION
- Quand user valide (dit "ok", "oui", "valide", "génère", "parfait", etc.)
- Appeler generate_carousel_slide avec :
  * slideIndex: 0 (pour slide 1), puis 1, 2, etc.
  * slideContent: le JSON de la slide validée
- Afficher l'image générée

ÉTAPE 4 : PASSER À LA SLIDE SUIVANTE
- Afficher Slide 2 en texte
- Demander validation
- Générer après validation
- Et ainsi de suite jusqu'à la dernière slide

RÈGLES :
- Ne JAMAIS générer toutes les images d'un coup
- Toujours attendre la validation du client avant de générer
- Si le client demande une modification (ex: "change le titre"), mettre à jour le plan et redemander validation
- Garder en mémoire le plan complet pour référence

GESTION DES VALIDATIONS SLIDES :

Quand l'utilisateur répond après avoir vu une slide en texte :
- Si réponse positive ("ok", "oui", "valide", "génère", "parfait", "nickel", etc.)
  → Appeler generate_carousel_slide avec l'index de la slide actuelle
  → Dire : "🎨 Génération de la Slide X en cours..."
  
- Si demande de modification ("change le titre", "mets plutôt X", "reformule", etc.)
  → Mettre à jour le plan en mémoire
  → Réafficher la slide modifiée
  → Redemander validation
  
- Si passage à la slide suivante après génération
  → Afficher la Slide suivante en texte
  → Redemander validation

Garder en mémoire :
- Le plan complet (carouselPlan)
- L'index de la slide actuelle (currentSlideIndex)
- Le job_set_id du carrousel en cours

4️⃣ ERREURS
Message clair + bouton d'action mentale "Réessayer"
Exemple : "❌ Erreur de génération. Je peux réessayer avec un autre moteur si tu veux ?"

5️⃣ ÉTAT GÉNÉRATION
- Pendant : "✳️ Génération (15–20s)…"
- Après : Vignettes cliquables + infos succinctes

6️⃣ STYLE GÉNÉRAL
- Français, clair, concis
- Tutoiement naturel et chaleureux (jamais robotique)
- Réactions émotionnelles authentiques
- Transparent et rassurant sur les coûts
- Toujours bienveillant jamais mécanique
- INTERDIT ABSOLU: N'utilise JAMAIS les caractères markdown **, __, *, #, ou tout autre formatage
- Texte brut uniquement avec retours à la ligne pour la structure
- Utilise des emojis avec modération pour l'expressivité : 🐾 ✨ 🎨 💡 🪄
- Ton conversationnel fluide et naturel, comme dans un vrai chat

🧪 EXEMPLES DE QUESTIONS "juste ce qu'il faut"

Vidéo :
"Tu préfères voix off FR ou sous-titres FR ? Durée 10 s (Sora) ou 15–20 s (Veo3) ?"

Image :
"Tu veux un texte FR à l'écran ? Si oui, tu me donnes la phrase exacte ?"

Template Canva :
"Tu as un lien de template Canva ou je pars sur une recherche par mots-clés ? Formats à livrer : carré / vertical / horizontal ?"

    // VIDÉO via Sora 2 (avec fallbacks automatiques)
    ⚠️ RÈGLE CRITIQUE - DÉTECTION VIDÉO
    Si l'utilisateur demande une vidéo, anime, clip, montage, reel, ou animation :
    → TU DOIS appeler generate_video avec un prompt en anglais
    → Coût = 1 Woof par clip (génération 5-15 secondes)
    → Le système essaiera automatiquement : Sora2 → Seededance → Kling
    → Si >15s demandés : propose un montage multi-clips

🎨 RÉPONSES APRÈS APPEL DE TOOLS

Quand tu appelles un tool, tu DOIS répondre en fonction du résultat :

- create_carousel → "🎨 Carrousel de {count} slides lancé ! Suivi en temps réel ci-dessous."
- generate_image → "✨ Image générée avec succès ! (1 crédit utilisé)"
- generate_video → "🎬 Vidéo en cours de génération avec {provider}... (2 Woofs)"
- show_usage → Afficher les quotas en format lisible
- adapt_template → "Template Canva ouvert avec ton Brand Kit !"

⚠️ NE PAS confondre carrousel (N slides) et image unique (1 crédit).

🎯 ORDRE DE PRIORITÉ DES TOOLS

Quand tu détectes une intention, appelle le tool AVANT de répondre :

1. create_carousel → Carrousels multi-slides (APPELER IMMÉDIATEMENT)
2. generate_image → Image unique
3. generate_video → Vidéo courte
4. browse_templates → Recherche templates Canva
5. show_usage → Quotas
6. check_credits → Crédits IA

⚠️ NE JAMAIS expliquer ce que tu vas faire sans appeler le tool d'abord.
✅ TOUJOURS appeler le tool, PUIS répondre après le résultat.

----------------
EXEMPLES CONCRETS
----------------

Exemple CARROUSEL :
Utilisateur : "Fais-moi un carrousel de 5 slides sur les avantages d'Alfie"
✅ BON WORKFLOW :
1. Détecter "carrousel" → intention = CARROUSEL
2. Clarifier : "Canal ? Objectif ? Public ?"
3. Appeler plan_carousel(prompt="Alfie benefits", count=5)
4. Présenter Slide 1 en texte : "Slide 1 : Titre X, Bullets: [...]"
5. Attendre validation ("ok", "génère", "parfait")
6. generate_carousel_slide(slideIndex=0, slideContent={...})
7. Répéter pour Slide 2, 3, 4, 5

❌ MAUVAIS WORKFLOW (à NE JAMAIS faire) :
1. Détecter "carrousel"
2. Appeler directement generate_image → ❌ ERREUR ! Une seule image générée au lieu de 5 slides

Exemple IMAGE :
Utilisateur : "Fais-moi une image pour Instagram"
✅ BON WORKFLOW :
1. Détecter "image" → intention = IMAGE
2. Clarifier : "Ratio 1:1 ou 4:5 ? Objectif ?"
3. generate_image(prompt="...", aspect_ratio="1:1")
`;

    const tools = [
      {
        type: "function",
        function: {
          name: "browse_templates",
          description: "Search for Canva templates based on criteria like category, keywords, or ratio",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Template category/niche (e.g., 'social_media', 'marketing')" },
              keywords: { type: "string", description: "Keywords to search for in template titles/descriptions" },
              ratio: { type: "string", description: "Aspect ratio (e.g., '1:1', '16:9', '9:16', '4:5')" },
              limit: { type: "number", description: "Maximum number of results (default: 5)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_brandkit",
          description: "Show the user's current Brand Kit (colors, logo, fonts)",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "open_canva",
          description: "Open a Canva template or import a generated image into Canva",
          parameters: {
            type: "object",
            properties: {
              template_url: { type: "string", description: "The Canva template URL to open (if using existing template)" },
              generated_image_url: { type: "string", description: "The generated image URL to import into Canva (if using AI-generated image)" },
              template_title: { type: "string", description: "The template title for confirmation" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_ai_version",
          description: "Generate an AI-styled version of a template using Nano-Banana (costs 1 credit)",
          parameters: {
            type: "object",
            properties: {
              template_image_url: { type: "string", description: "URL of the template image to transform" },
              template_title: { type: "string", description: "Template title for reference" },
              style_instructions: { type: "string", description: "Specific style adjustments to apply" }
            },
            required: ["template_image_url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_credits",
          description: "Check the user's remaining AI generation credits",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_image",
          description: "Generate an image from a text prompt (1 crédit). Supports different aspect ratios for social media.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Detailed description of the image to generate" },
              aspect_ratio: { 
                type: "string", 
                description: "Aspect ratio for the image (default: 1:1). Options: 1:1 (Instagram post), 4:5 (Instagram portrait), 9:16 (Instagram story/TikTok), 16:9 (YouTube/Twitter)", 
                enum: ["1:1", "4:5", "9:16", "16:9"]
              }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "improve_image",
          description: "Improve an existing image with AI (1 crédit). User must provide image URL.",
          parameters: {
            type: "object",
            properties: {
              image_url: { type: "string", description: "URL of the image to improve" },
              instructions: { type: "string", description: "Specific improvements to apply" }
            },
            required: ["image_url", "instructions"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_video",
          description: "Generate a video from a text prompt. Uses Sora2 → Seededance → Kling fallback. Cost: 1 Woof per video (5-15s). For >15s, suggest multi-clip approach.",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Detailed description of the video to generate (in English for best quality)" },
              aspectRatio: { type: "string", description: "Video aspect ratio: '16:9' (landscape) or '9:16' (portrait). Default: '16:9'" },
              imageUrl: { type: "string", description: "Optional: URL of uploaded image to use as video base (image→video)" }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "show_usage",
          description: "Show the user's current quota usage (visuals, videos, Woofs) for their active brand",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "adapt_template",
          description: "Apply Brand Kit to a Canva template (colors, logo, fonts). FREE, not counted in quotas.",
          parameters: {
            type: "object",
            properties: {
              template_id: { type: "string", description: "Canva template ID" },
              template_title: { type: "string", description: "Template title for confirmation" }
            },
            required: ["template_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "package_download",
          description: "Prepare a ZIP package with download links for user's generated assets",
          parameters: {
            type: "object",
            properties: {
              asset_ids: { type: "array", items: { type: "string" }, description: "Asset IDs to include in package (optional, all if empty)" },
              filter_type: { type: "string", description: "Filter by type: 'images', 'videos', or 'all' (default)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "plan_carousel",
          description: "Generate a structured text plan for a carousel (returns JSON with all slides content, no images generated yet)",
          parameters: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Carousel theme/objective in English" },
              count: { type: "number", description: "Number of slides (default: 5)" },
              aspect_ratio: { type: "string", description: "Aspect ratio: '1:1' or '4:5'" }
            },
            required: ["prompt"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_carousel_slide",
          description: "Generate a single carousel slide image from validated text content",
          parameters: {
            type: "object",
            properties: {
              slideIndex: { type: "number", description: "Index of the slide (0-based)" },
              slideContent: { 
                type: "object", 
                description: "Validated slide content (title, subtitle, bullets, kpis)" 
              },
              aspect_ratio: { type: "string", description: "Aspect ratio: '1:1' or '4:5'" }
            },
            required: ["slideIndex", "slideContent"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "classify_intent",
          description: "Classify user request into intent: image, carousel, video, or other",
          parameters: {
            type: "object",
            properties: {
              user_message: { type: "string", description: "User's raw message" }
            },
            required: ["user_message"]
          }
        }
      }
    ];

    const response = await fetch(AI_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.model, // Modèle configurable via env variable
        messages: [
          { role: "system", content: systemPrompt },
          ...transformedMessages
        ],
        tools: tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédit insuffisant. Contactez le support." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
    });
  } catch (error) {
    console.error("Error in alfie-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
