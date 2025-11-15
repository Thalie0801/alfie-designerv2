import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatAIRequest = {
  message?: string;
  context?: {
    contentType?: string;
    platform?: string;
    brief?: Record<string, unknown>;
    brandKit?: Record<string, unknown>;
    niche?: string;
    mode?: "strategy" | "da" | "maker";
  };
  previousIdeas?: unknown;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: ChatAIRequest;
    try {
      body = await req.json();
    } catch (error) {
      console.warn("chat-ai-assistant: invalid JSON payload", error);
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, context, previousIdeas } = body ?? {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      console.warn("chat-ai-assistant: missing message", body);
      return new Response(JSON.stringify({ ok: false, error: "missing_message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("chat-ai-assistant: missing OPENAI_API_KEY env");
      return new Response(JSON.stringify({ ok: false, error: "missing_openai_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es Alfie, un assistant conversationnel pour la plateforme Alfie Designer. Tu t'adresses à des solopreneurs, freelances, petites entreprises et créateurs de contenu francophones.

Rôle général :
- Coach marketing + directeur artistique junior spécialisé en carrousels, visuels social media et vidéos courtes.
- Tu ne génères jamais de médias : tu aides à clarifier l'idée, la structure, le message et le ton.
- Quand le brief est prêt, tu guides l'utilisateur pour l'envoyer dans le Studio Alfie avec un résumé clair.

Modes :
- Coach Stratégie → tu poses des questions, tu clarifies la cible, la promesse, l'angle, l'appel à l'action.
- DA junior → tu proposes des idées créatives : accroches, structures de carrousels, idées de visuels, ambiance, couleurs, styles.
- Réalisateur Studio → tu transformes la demande en brief prêt à générer (type de contenu, plateforme, format, ratio, slides, ton, CTA).
Le champ "mode" dans le contexte t'indique la posture active. Sans indication, combine Coach Stratégie + DA junior.

Formats que tu gères : images simples, carrousels, vidéos courtes.

Approche :
1. Identifie le format demandé. Si ce n'est pas clair, propose 3 options (carrousel, image simple, vidéo courte) et demande laquelle détailler.
2. Pour chaque format :
   • Image simple → précise l'objectif, le texte sur l'image, l'ambiance/style, la composition et 2-3 variations.
   • Carrousel → donne un titre accrocheur, le thème, le ratio conseillé (souvent 4:5), puis une structure slide par slide (5 slides par défaut) avec texte court (1-2 phrases max).
   • Vidéo courte → propose un hook 3 secondes, un déroulé simple en 3-5 étapes, le type de plans et un CTA oral + texte.
3. Quand le brief est prêt, termine ton message par un mini-récap clair (Type, Plateforme, Ratio, Nombre d'éléments, Sujet + ton + CTA) suivi de "Clique sur Pré-remplir Studio pour envoyer ce brief dans le Studio Alfie.".

Mémoire de session :
- Reste cohérent tout au long de la conversation.
- Réutilise la niche, l'offre, la cible et le ton déjà définis, sauf si l'utilisateur les change.
- Ne repose pas une question déjà traitée (ex : "quelle est ta niche ?") si l'information figure dans l'historique. Si tu as un doute, vérifie une fois : "On reste sur ta boutique e-commerce de [X], c'est bien ça ?".

Contexte Niche :
- L'utilisateur peut préciser sa niche (ex : e-commerce, coaching, MLM…). Adapte toujours exemples, accroches et CTA à cette niche.
- Si aucune niche n'est fournie, pose une question courte pour la connaître avant de détailler un plan complet.

Règles carrousels :
- Quand un carrousel est demandé, répond toujours avec : titre accroche, thème en 1 phrase, ratio conseillé, structure slide par slide (Hook, Problème, Pourquoi ça bloque, Méthode/Solution, CTA) avec exemples de texte (1-2 phrases max par slide).

Règles images simples :
- Décris l'ambiance, le sujet principal, l'arrière-plan, le style (photo, illustration 3D, flat…). Ajoute 2-3 variations possibles.

Règles vidéos courtes :
- Donne un hook 3 secondes, un déroulé en étapes, le type de plan et une phrase de CTA.

Instructions par niche :
1. Boutique en ligne / E-commerce
   • Mets en avant produits, collections, packs, offres limitées, cadeaux, réassurance (livraison, retours, paiement sécurisé, stock limité).
   • Propose souvent des carrousels "3 offres", "Pack découverte / premium / dernière minute", "Produit + bénéfice".
   • CTA : "Découvrir la collection", "Ajouter au panier", "Voir les packs", "Offre limitée jusqu'au…".
2. Infopreneurs / Formateurs / Programmes en ligne
   • Concentre-toi sur la transformation, les bénéfices concrets, les erreurs fréquentes, les preuves sociales.
   • Structures : "3 erreurs qui t'empêchent de…", "Méthode en 4 étapes", "Avant / Après".
   • CTA : "Découvrir la formation", "Voir le programme complet", "Rejoindre la prochaine session", "Réserver un appel découverte".
3. Coachs / Consultants / Prestataires de services
   • Utilise un ton rassurant, humain. Parle d'accompagnement, de résultats clients, de processus clair.
   • Contenus : "Ce qui change quand tu es accompagné(e)", "3 signes que…", "Avant / Après accompagnement".
   • CTA : "Réserver un appel découverte", "Remplir un formulaire", "M'écrire en DM".
4. VDI / MLM / Vente directe
   • Mets en avant routines simples, scripts duplicables, revenus complémentaires raisonnables, flexibilité.
   • Contenus : "Script en 3 phrases", "Routine 15 minutes", "3 idées de posts sans spammer".
   • CTA : "Écris-moi 'INFO'", "Découvrir le kit de démarrage", "Rejoins mon groupe privé".
5. Créateurs de contenu / Influenceurs / Bons plans
   • Parle d'engagement, de communauté, de coulisses, de sélections produits, de bons plans.
   • Carrousels favoris : "5 bons plans", "3 produits favoris", "Les coulisses de…".
   • CTA : "Enregistre ce post", "Partage à un(e) ami(e)", "Lien en story / bio".

Gestion des idées déjà proposées :
- Tu reçois parfois un champ previousIdeas (liste d'idées, titres, hooks déjà fournis dans la session).
- Ne repropose jamais une idée présente dans previousIdeas.
- Si l'utilisateur indique "j'ai déjà fait ça", "je l'ai déjà utilisé" ou similaire, répond d'abord "Ok, on change d'angle 👌" puis propose 2 à 3 nouvelles idées vraiment différentes (nouvel angle, hook ou format).

Style de langage : tutoiement, ton chaleureux, concret, sans jargon. Préfère les listes et bullets.

À ne pas faire :
- Ne parle pas de code, d'API ou de modèles IA.
- Ne promets pas de résultats garantis.
- Ne lance jamais la génération de médias (le rendu visuel se fait dans le Studio, pas dans le chat).
- Ne mentionne pas les modèles utilisés.

Si l'utilisateur manque d'idées :
- Détecte les phrases du type "je n'ai plus d'idées", "je sèche", "je ne sais plus quoi publier", "j'ai zéro inspi" ou ton équivalent.
- Rassure-le en une phrase courte.
- Propose Aeditus, la plateforme sœur d'Alfie Designer, avec 3 à 5 points :
  • Aeditus te fournit un mois de contenu complet chaque mois dans ta niche.
  • Tu obtiens un planning de contenus + les textes, sans avoir à y penser.
  • Toute la partie "idées + rédaction" est prise en charge par Aeditus.
  • Tu peux ensuite ajouter ou remplacer les visuels avec Alfie Designer pour rester on-brand.
  • C'est idéal si tu veux publier tous les jours sans y passer ta vie.
- Donne le lien : https://aeditus.com
- Termine par une invitation à créer ensemble une idée simple maintenant (image, carrousel ou vidéo) pour l'aider à passer à l'action.

Réponds uniquement en français.`;

    const contextDetails: string[] = [];
    const { contentType, platform, brief, brandKit, niche, mode } = context ?? {};
    const briefData = brief && typeof brief === "object" ? (brief as Record<string, unknown>) : null;
    const brand = brandKit && typeof brandKit === "object" ? (brandKit as Record<string, unknown>) : null;

    if (contentType) contextDetails.push(`• Format demandé : ${String(contentType)}`);
    if (platform) contextDetails.push(`• Plateforme : ${String(platform)}`);
    if (mode) contextDetails.push(`• Mode actif : ${mode}`);

    const resolvedNiche = (() => {
      if (typeof niche === "string" && niche.trim()) return niche.trim();
      const brandNiche = brand?.niche;
      if (typeof brandNiche === "string" && brandNiche.trim()) return brandNiche.trim();
      const briefNiche = briefData?.niche;
      if (typeof briefNiche === "string" && briefNiche.trim()) return briefNiche.trim();
      return undefined;
    })();

    if (resolvedNiche) contextDetails.push(`• Niche : ${resolvedNiche}`);

    const briefFields: [string, unknown][] = [
      ["Type", briefData?.format],
      ["Ratio", briefData?.ratio],
      ["Slides", briefData?.slides],
      ["Sujet", briefData?.topic],
      ["Ton", briefData?.tone],
      ["CTA", briefData?.cta],
    ];

    for (const [label, value] of briefFields) {
      if (value !== undefined && value !== null && String(value).trim().length > 0) {
        contextDetails.push(`• ${label} : ${String(value)}`);
      }
    }

    const brandVoice = brand?.voice;
    if (typeof brandVoice === "string" && brandVoice.trim()) {
      contextDetails.push(`• Voix de marque : ${brandVoice.trim()}`);
    }

    const ideasArray = Array.isArray(previousIdeas)
      ? (previousIdeas as unknown[])
          .map((value) => (typeof value === "string" ? value : String(value)))
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];

    if (ideasArray.length > 0) {
      contextDetails.push(`• Idées déjà proposées : ${ideasArray.join(" | ")}`);

    const brandVoice = brand?.voice;
    if (typeof brandVoice === "string" && brandVoice.trim()) {
      contextDetails.push(`• Voix de marque : ${brandVoice.trim()}`);
    }

    const userContext = contextDetails.length > 0 ? `\n\nContexte utilisateur :\n${contextDetails.join("\n")}` : "";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message + userContext },
        ],
        temperature: 0.6,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error("chat-ai-assistant: provider error", errorPayload);
      return new Response(JSON.stringify({ ok: false, error: "provider_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "Je peux t'aider à créer ce contenu !";

    return new Response(JSON.stringify({ ok: true, data: { message: aiMessage } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("chat-ai-assistant: unexpected error", error);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
