/**
 * alfie-generate-texts
 * 
 * Génère les textes structurés pour un pack d'assets avant la génération visuelle
 * Utilise Gemini pour créer des textes marketing en français parfait
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY } from "../_shared/env.ts";

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

interface BrandKit {
  name?: string;
  palette?: string[];
  voice?: string;
  niche?: string;
}

interface AssetBrief {
  id: string;
  kind: "image" | "carousel" | "video_basic" | "video_premium";
  title: string;
  goal: string;
  tone: string;
  platform: string;
  ratio: string;
  count?: number; // Pour carrousels
  durationSeconds?: number; // Pour vidéos
  prompt: string;
}

interface SlideText {
  title: string;
  subtitle?: string;
  bullets?: string[];
}

interface ImageText {
  title: string;
  body: string;
  cta?: string;
}

interface VideoText {
  script: string;
  hook: string;
  cta?: string;
}

interface GeneratedTexts {
  [assetId: string]: {
    kind: string;
    slides?: SlideText[]; // Pour carrousels
    text?: ImageText; // Pour images
    video?: VideoText; // Pour vidéos
  };
}

async function callGemini(systemPrompt: string, userPrompt: string) {
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
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function buildCarouselPrompt(asset: AssetBrief, brandKit: BrandKit, brief: string, useBrandKit: boolean): string {
  let prompt = `Génère les textes pour un carrousel de ${asset.count || 5} slides pour réseaux sociaux.

[CAMPAGNE_BRIEF]
${brief}

[BRAND_KIT_ENABLED]
${useBrandKit}
`;

  if (useBrandKit) {
    prompt += `
[BRAND_KIT]
- Marque : ${brandKit.name || "Non spécifié"}
- Secteur : ${brandKit.niche || "Non spécifié"}
- Ton : ${brandKit.voice || "Non spécifié"}

INSTRUCTIONS : Utilise le Brand Kit pour adapter le ton et le style, mais le CONTENU doit venir du BRIEF. Le BRIEF est PRIORITAIRE.`;
  } else {
    prompt += `
[BRAND_KIT]
- Secteur : ${brandKit.niche || "Non spécifié"}

⚠️ RÈGLE ABSOLUE : Brand Kit DÉSACTIVÉ par l'utilisateur.
Tu NE DOIS PAS utiliser :
- Le ton de voix, le style ou les couleurs de la marque
- Les mascottes, personnages ou éléments narratifs du Brand Kit
- Les références à l'identité de marque

Crée des textes NEUTRES et GÉNÉRIQUES basés UNIQUEMENT sur le brief de campagne.`;
  }

  prompt += `
  
CONTEXTE ASSET :
- Titre : ${asset.title}
- Objectif : ${asset.goal}
- Plateforme : ${asset.platform}
- Format : ${asset.ratio}
- Style du visuel : ${asset.tone}

STRUCTURE ATTENDUE (progression narrative) :
Slide 1 : Accroche / Hook percutant
Slide 2 : Problème / Agitation
Slides 3-4 : Solution / Bénéfices / Preuve
Slide 5 : Call-to-Action

RÈGLES CRITIQUES :
- LE BRIEF EST PRIORITAIRE sur le Brand Kit
- Français PARFAIT, sans aucune faute d'orthographe
- Textes courts, lisibles, adaptés au format visuel
- Ne JAMAIS écrire de codes couleur ni de texte technique

Retourne un JSON strictement conforme à ce format :
{
  "slides": [
    { "title": "Titre slide 1", "subtitle": "Sous-titre optionnel", "bullets": ["Point 1", "Point 2"] },
    ...
  ]
}`;

  return prompt;
}

function buildImagePrompt(asset: AssetBrief, brandKit: BrandKit, brief: string, useBrandKit: boolean): string {
  let prompt = `Génère le texte marketing pour une image réseaux sociaux.

[CAMPAGNE_BRIEF]
${brief}

[BRAND_KIT_ENABLED]
${useBrandKit}
`;

  if (useBrandKit) {
    prompt += `
[BRAND_KIT]
- Marque : ${brandKit.name || "Non spécifié"}
- Secteur : ${brandKit.niche || "Non spécifié"}
- Ton : ${brandKit.voice || "Non spécifié"}

INSTRUCTIONS : Utilise le Brand Kit pour adapter le ton et le style, mais le CONTENU doit venir du BRIEF. Le BRIEF est PRIORITAIRE.`;
  } else {
    prompt += `
[BRAND_KIT]
- Secteur : ${brandKit.niche || "Non spécifié"}

⚠️ RÈGLE ABSOLUE : Brand Kit DÉSACTIVÉ.
Ne pas utiliser le ton, les couleurs ou les éléments narratifs de la marque.
Textes NEUTRES basés uniquement sur le brief.`;
  }

  prompt += `

CONTEXTE ASSET :
- Titre : ${asset.title}
- Objectif : ${asset.goal}
- Plateforme : ${asset.platform}
- Format : ${asset.ratio}
- Style du visuel : ${asset.tone}
- Description : ${asset.prompt}

RÈGLES CRITIQUES :
- LE BRIEF EST PRIORITAIRE sur le Brand Kit
- Français PARFAIT, sans aucune faute d'orthographe
- Titre percutant (max 8 mots)
- Texte principal concis et impactant (max 20 mots)
- CTA clair et engageant (optionnel, max 5 mots)
- Ne JAMAIS écrire de codes couleur ni de texte technique

Retourne un JSON strictement conforme à ce format :
{
  "title": "Titre accrocheur",
  "body": "Texte principal court et percutant",
  "cta": "Call-to-action optionnel"
}`;

  return prompt;
}

function buildVideoPrompt(asset: AssetBrief, brandKit: BrandKit, brief: string, useBrandKit: boolean): string {
  let prompt = `Génère le script pour une vidéo réseaux sociaux de ${asset.durationSeconds || 10} secondes.

[CAMPAGNE_BRIEF]
${brief}

[BRAND_KIT_ENABLED]
${useBrandKit}
`;

  if (useBrandKit) {
    prompt += `
[BRAND_KIT]
- Marque : ${brandKit.name || "Non spécifié"}
- Secteur : ${brandKit.niche || "Non spécifié"}
- Ton : ${brandKit.voice || "Non spécifié"}

INSTRUCTIONS : Utilise le Brand Kit pour adapter le ton et le style, mais le CONTENU doit venir du BRIEF. Le BRIEF est PRIORITAIRE.`;
  } else {
    prompt += `
[BRAND_KIT]
- Secteur : ${brandKit.niche || "Non spécifié"}

⚠️ RÈGLE ABSOLUE : Brand Kit DÉSACTIVÉ.
Script NEUTRE sans ton de marque ni éléments narratifs spécifiques.`;
  }

  prompt += `

CONTEXTE ASSET :
- Titre : ${asset.title}
- Objectif : ${asset.goal}
- Plateforme : ${asset.platform}
- Durée : ${asset.durationSeconds || 10}s
- Style : ${asset.tone}
- Description : ${asset.prompt}

RÈGLES CRITIQUES :
- LE BRIEF EST PRIORITAIRE sur le Brand Kit
- Français PARFAIT, sans aucune faute d'orthographe
- Hook fort dès les 2 premières secondes
- Script adapté à la durée (environ ${Math.round((asset.durationSeconds || 10) / 3)} phrases)
- CTA clair en conclusion

Retourne un JSON strictement conforme à ce format :
{
  "hook": "Phrase d'accroche puissante",
  "script": "Script complet de la vidéo, phrase par phrase",
  "cta": "Call-to-action final"
}`;

  return prompt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, brief, assets, useBrandKit = true } = await req.json() as {
      brandId: string;
      brief: string;
      assets: AssetBrief[];
      useBrandKit?: boolean;
    };

    if (!brandId || !assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing brandId or assets" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer le Brand Kit complet
    const { data: brand, error: brandError } = await supabaseAdmin
      .from("brands")
      .select("name, palette, voice, niche, fonts")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      console.error("Brand fetch error:", brandError);
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brandKit: BrandKit = {
      name: brand.name,
      palette: brand.palette as string[] || [],
      voice: brand.voice || undefined,
      niche: brand.niche || undefined,
    };

    // Générer les textes pour chaque asset
    const generatedTexts: GeneratedTexts = {};

    for (const asset of assets) {
      try {
        let prompt: string;
        let systemPrompt = "Tu es un expert en copywriting pour réseaux sociaux. Tu génères des textes marketing en français parfait, adaptés à chaque marque et objectif.";

        if (asset.kind === "carousel") {
          prompt = buildCarouselPrompt(asset, brandKit, brief, useBrandKit);
        } else if (asset.kind.includes("video")) {
          prompt = buildVideoPrompt(asset, brandKit, brief, useBrandKit);
        } else {
          // image only
          prompt = buildImagePrompt(asset, brandKit, brief, useBrandKit);
        }

        const response = await callGemini(systemPrompt, prompt);
        
        // Parser la réponse JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`No JSON found for asset ${asset.id}, using fallback`);
          generatedTexts[asset.id] = {
            kind: asset.kind,
            text: {
              title: asset.title,
              body: asset.prompt.slice(0, 100),
              cta: undefined,
            },
          };
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (asset.kind === "carousel") {
          generatedTexts[asset.id] = {
            kind: "carousel",
            slides: parsed.slides || [],
          };
        } else if (asset.kind.includes("video")) {
          generatedTexts[asset.id] = {
            kind: asset.kind,
            video: parsed,
          };
        } else {
          generatedTexts[asset.id] = {
            kind: asset.kind,
            text: parsed,
          };
        }
      } catch (error) {
        console.error(`Error generating texts for asset ${asset.id}:`, error);
        // Fallback : utiliser les données existantes
        generatedTexts[asset.id] = {
          kind: asset.kind,
          text: {
            title: asset.title,
            body: asset.prompt.slice(0, 100),
          },
        };
      }
    }

    return new Response(
      JSON.stringify({ ok: true, texts: generatedTexts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in alfie-generate-texts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
