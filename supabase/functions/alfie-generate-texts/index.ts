/**
 * alfie-generate-texts
 * 
 * Génère les textes structurés pour un pack d'assets avant la génération visuelle
 * 
 * ARCHITECTURE:
 * - Priorité 1: Vertex AI Gemini 2.5 Flash
 * - Priorité 2: Lovable AI (fallback uniquement)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY } from "../_shared/env.ts";
import { callVertexGeminiText, isVertexGeminiTextConfigured } from "../_shared/vertexGeminiText.ts";

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

interface BrandKit {
  name?: string;
  palette?: string[];
  voice?: string;
  niche?: string;
}

interface TextLayout {
  has_title?: boolean;
  has_subtitle?: boolean;
  has_body?: boolean;
  has_bullets?: boolean;
}

interface AssetBrief {
  id: string;
  kind: "image" | "carousel" | "video_basic" | "video_premium";
  title: string;
  goal: string;
  tone: string;
  platform: string;
  ratio: string;
  count?: number;
  durationSeconds?: number;
  prompt: string;
  carouselType?: "citations" | "content";
  textLayout?: TextLayout;
}

interface SlideText {
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  author?: string;
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
    slides?: SlideText[];
    text?: ImageText;
    video?: VideoText;
  };
}

/**
 * Appelle Gemini via Vertex AI (priorité) ou Lovable AI (fallback)
 */
async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  // Priorité 1: Vertex AI Gemini
  if (isVertexGeminiTextConfigured()) {
    console.log("[alfie-generate-texts] 🎯 Using Vertex AI Gemini Flash...");
    const vertexResult = await callVertexGeminiText(systemPrompt, userPrompt, "flash");
    if (vertexResult) {
      return vertexResult;
    }
    console.log("[alfie-generate-texts] ⚠️ Vertex AI failed, falling back to Lovable AI...");
  }

  // Priorité 2: Lovable AI (fallback)
  console.log("[alfie-generate-texts] 🔄 Using Lovable AI fallback...");
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
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function buildCitationsPrompt(asset: AssetBrief, brandKit: BrandKit, brief: string, useBrandKit: boolean): string {
  return `Génère ${asset.count || 5} citations inspirantes pour un carrousel.

[CAMPAGNE_BRIEF]
${brief}

[CONTEXTE]
- Secteur : ${brandKit.niche || "Non spécifié"}
- Objectif : ${asset.goal}
- Plateforme : ${asset.platform}

STRUCTURE ATTENDUE - CHAQUE SLIDE = UNE CITATION :
{
  "slides": [
    { "title": "La citation ici", "author": "Nom de l'Auteur" },
    { "title": "Deuxième citation", "author": "Autre Auteur" },
    ...
  ]
}

RÈGLES CRITIQUES :
- PAS de sous-titre, PAS de bullets, UNIQUEMENT title + author
- Citations COURTES (max 120 caractères)
- Auteurs réels ou attribués selon le contexte
- Français PARFAIT, sans faute
- Les citations doivent être en rapport avec le brief
- Varier les auteurs (célèbres, experts du domaine, anonymes)`;
}

function buildCarouselPrompt(asset: AssetBrief, brandKit: BrandKit, brief: string, useBrandKit: boolean): string {
  // ✅ Déterminer la structure de texte demandée
  const textLayout = asset.textLayout || { has_title: true, has_subtitle: true, has_body: true, has_bullets: false };
  const hasTitle = textLayout.has_title !== false;
  const hasSubtitle = textLayout.has_subtitle === true;
  const hasBody = textLayout.has_body === true;
  const hasBullets = textLayout.has_bullets === true;
  
  // ✅ Construire la liste des champs à générer
  const fields: string[] = [];
  if (hasTitle) fields.push('title (max 40 caractères)');
  if (hasSubtitle) fields.push('subtitle (max 60 caractères)');
  if (hasBody) fields.push('body (max 120 caractères)');
  if (hasBullets) fields.push('bullets (max 3, max 20 caractères chacun)');
  
  // ✅ Construire l'exemple JSON
  const jsonFields: string[] = [];
  if (hasTitle) jsonFields.push('"title": "Max 40 car"');
  if (hasSubtitle) jsonFields.push('"subtitle": "Max 60 car"');
  if (hasBody) jsonFields.push('"body": "Max 120 car"');
  if (hasBullets) jsonFields.push('"bullets": []');
  
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

STRUCTURE ATTENDUE PAR SLIDE :
${fields.map((f, i) => `${i + 1}. ${f}`).join('\n')}

⚠️ CONTRAINTES DE CARACTÈRES ABSOLUES - AUCUN DÉPASSEMENT TOLÉRÉ :
${hasTitle ? '- title : MAXIMUM 40 caractères' : ''}
${hasSubtitle ? '- subtitle : MAXIMUM 60 caractères (1 phrase courte)' : ''}
${hasBody ? '- body : MAXIMUM 120 caractères (1-2 phrases courtes)' : ''}
${hasBullets ? '- bullets : max 3 par slide, max 20 caractères chacun' : ''}

⚠️ SI UN TEXTE DÉPASSE LA LIMITE, NE PAS TRONQUER MAIS RÉÉCRIRE EN PLUS COURT.
NE JAMAIS couper un mot ou une phrase au milieu.

RÈGLES CRITIQUES :
- COMPTER LES CARACTÈRES avant de finaliser chaque texte
- CHAQUE SLIDE DOIT AVOIR ${fields.map(f => f.split(' ')[0]).join(', ')} remplis
- LE BRIEF EST PRIORITAIRE sur le Brand Kit
- Français PARFAIT, sans aucune faute d'orthographe
- Ne JAMAIS écrire de codes couleur ni de texte technique

Retourne un JSON strictement conforme à ce format :
{
  "slides": [
    { ${jsonFields.join(', ')} },
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

    console.log(`[alfie-generate-texts] 🚀 Generating texts for ${assets.length} assets (Vertex AI: ${isVertexGeminiTextConfigured() ? 'YES' : 'NO'})`);

    const generatedTexts: GeneratedTexts = {};

    for (const asset of assets) {
      try {
        let prompt: string;
        const systemPrompt = "Tu es un expert en copywriting pour réseaux sociaux. Tu génères des textes marketing en français parfait, adaptés à chaque marque et objectif.";

        if (asset.kind === "carousel") {
          if (asset.carouselType === "citations") {
            prompt = buildCitationsPrompt(asset, brandKit, brief, useBrandKit);
          } else {
            prompt = buildCarouselPrompt(asset, brandKit, brief, useBrandKit);
          }
        } else if (asset.kind.includes("video")) {
          prompt = buildVideoPrompt(asset, brandKit, brief, useBrandKit);
        } else {
          prompt = buildImagePrompt(asset, brandKit, brief, useBrandKit);
        }

        const response = await callGemini(systemPrompt, prompt);
        
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
          let validSlides = parsed.slides || [];
          
          if (validSlides.length > 0 && validSlides[0]?.title) {
            const firstTitle = validSlides[0].title;
            const hasConcatenation = firstTitle.includes('\n') || 
                                     firstTitle.includes('Slide ') || 
                                     firstTitle.length > 120;
            
            if (hasConcatenation) {
              console.warn(`[alfie-generate-texts] ⚠️ Detected concatenated title, splitting...`);
              const splitTitles = firstTitle
                .split(/\n+|Slide\s*\d+\s*:\s*/i)
                .filter((s: string) => s.trim())
                .map((s: string) => s.trim());
              
              if (splitTitles.length > 1) {
                validSlides = splitTitles.slice(0, asset.count || 5).map((title: string, i: number) => ({
                  title,
                  subtitle: validSlides[i]?.subtitle || "",
                  bullets: validSlides[i]?.bullets || [],
                  author: validSlides[i]?.author || undefined,
                }));
              }
            }
          }
          
          // ✅ Normalisation avec limites de caractères strictes pour compatibilité Canva
          // ✅ Utilisation de smartTruncate au lieu de slice brutal
          validSlides = validSlides.map((slide: any, idx: number) => {
            const rawTitle = typeof slide.title === 'string' ? slide.title.replace(/\n/g, ' ').trim() : "";
            const rawSubtitle = typeof slide.subtitle === 'string' ? slide.subtitle.trim() : "";
            const rawBody = typeof slide.body === 'string' ? slide.body.trim() : "";
            
            // ✅ Troncature intelligente au dernier mot complet
            const smartTruncate = (text: string, maxLen: number): string => {
              if (text.length <= maxLen) return text;
              const truncated = text.slice(0, maxLen);
              const lastSpace = truncated.lastIndexOf(' ');
              if (lastSpace > maxLen * 0.6) {
                return truncated.slice(0, lastSpace).trim();
              }
              return truncated.trim();
            };
            
            // ✅ Appliquer les limites strictes avec troncature intelligente
            const title = smartTruncate(rawTitle, 40);
            const subtitle = smartTruncate(rawSubtitle, 60);
            
            // Si body vide et subtitle trop long, utiliser le surplus comme body
            let body = smartTruncate(rawBody, 120);
            if (!body && rawSubtitle.length > 60) {
              body = smartTruncate(rawSubtitle.slice(60).trim(), 120);
            }
            // Fallback minimal pour body sur slides 2-5
            if (!body && idx > 0) {
              body = subtitle || title || "";
            }
            
            // ✅ Log si dépassement détecté (pour monitoring)
            if (rawTitle.length > 40 || rawSubtitle.length > 60) {
              console.warn(`[alfie-generate-texts] ⚠️ Slide ${idx + 1} text too long: title=${rawTitle.length}/40, subtitle=${rawSubtitle.length}/60`);
            }
            
            return {
              title,
              subtitle,
              body,
              bullets: Array.isArray(slide.bullets) 
                ? slide.bullets.slice(0, 3).map((b: string) => smartTruncate(String(b), 20)) 
                : [],
              author: slide.author || undefined,
            };
          });
          
          generatedTexts[asset.id] = {
            kind: "carousel",
            slides: validSlides,
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
        generatedTexts[asset.id] = {
          kind: asset.kind,
          text: {
            title: asset.title,
            body: asset.prompt.slice(0, 100),
          },
        };
      }
    }

    console.log(`[alfie-generate-texts] ✅ Generated texts for ${Object.keys(generatedTexts).length} assets`);

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
