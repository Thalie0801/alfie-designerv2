// functions/alfie-plan-carousel/index.ts
// v3.0.0 — Planificateur avec support "Brief Direct" pour textes et contraintes utilisateur

import { LOVABLE_API_KEY } from "../_shared/env.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { parseBrief, buildConstraintPrompt, buildStylePrompt, type ParsedBrief, type ParsedSlide } from "../_shared/briefParser.ts";

// ---------------------------
// Types
// ---------------------------
type SlideType = "hero" | "problem" | "solution" | "impact" | "cta";

interface BrandKit {
  name?: string;
  palette?: string[];
  voice?: string;
  niche?: string;
}

interface KPI {
  label: string;
  delta: string;
}

interface SlideContent {
  type: SlideType;
  title: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  cta?: string;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
  badge?: string;
  kpis?: KPI[];
}

interface CarouselPlan {
  style: string;
  prompts: string[];
  slides: SlideContent[];
}

interface InputBodyLegacy {
  topic?: string;
  numSlides?: number | string;
  brandVoice?: string;
  brandKit?: BrandKit;
}

interface InputBodyNew {
  prompt?: string;
  slideCount?: number;
  brandKit?: BrandKit;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "yt-thumb";
  language?: "FR" | "EN";
  visualStyleCategory?: "background" | "character" | "product";
  backgroundOnly?: boolean;
  parsedBrief?: ParsedBrief; // ✅ NEW: Pre-parsed brief from chat-create-carousel
}

// ---------------------------
// Utils
// ---------------------------
const MODEL = "google/gemini-2.5-flash" as const;
const MAX_SLIDES = 10;
const MIN_SLIDES = 3;

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const toInt = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const trimLen = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, Math.max(0, max));

const ensureHex = (c?: string) => ((c || "").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i) ? c! : undefined);

function first2Palette(palette?: string[]) {
  const p = Array.isArray(palette) ? palette.filter(Boolean) : [];
  const a = ensureHex(p[0]) ?? p[0] ?? "vibrant blue";
  const b = ensureHex(p[1]) ?? p[1] ?? "warm orange";
  return [a, b];
}

/**
 * ✅ V11: forceNoTextPrompt est maintenant category-aware
 * En mode background: génère un fond sans texte (pour ajout manuel)
 * En mode character/product: le texte sera intégré par Nano Banana Pro (ne pas bloquer)
 */
function forceNoTextPrompt(p: string, visualStyleCategory?: string): string {
  let result = `${p.trim()}. No visible HEX codes, no watermarks.`;
  
  // Seulement en mode background explicite : fond seul sans texte
  if (visualStyleCategory === 'background') {
    result += ' No text, no typography, no letters, no logos. Background/scene only.';
  }
  // Pour character/product : le texte sera intégré dans des cartes glassmorphism
  // Ne pas ajouter "no text" car le renderer va intégrer le texte
  
  return result;
}

function normalizeLanguage(code?: string): "FR" | "EN" {
  if (!code) return "FR";
  return code.toUpperCase() === "EN" ? "EN" : "FR";
}

function fixBullets(slide: SlideContent) {
  if (!Array.isArray(slide.bullets)) slide.bullets = [];
  slide.bullets = slide.bullets
    .map((b) => b?.trim())
    .filter(Boolean)
    .map((b) => trimLen(b, 44));

  // 3–4 bullets
  if (slide.bullets.length < 3) {
    while (slide.bullets.length < 3) {
      slide.bullets.push(`${trimLen(slide.title, 24)} — point clé`);
    }
  } else if (slide.bullets.length > 4) {
    slide.bullets = slide.bullets.slice(0, 4);
  }
}

function distributeTypes(slides: SlideContent[]) {
  // Si l'IA ne respecte pas la structure, on la force :
  if (slides.length === 0) return slides;
  slides[0].type = "hero";
  if (slides.length >= 2) {
    for (let i = 1; i < slides.length - 1; i++) {
      if (slides[i].type !== "problem" && slides[i].type !== "solution") {
        slides[i].type = i % 2 === 1 ? "problem" : "solution";
      }
    }
  }
  slides[slides.length - 1].type = "cta";
  return slides;
}

function applyHardValidations(plan: CarouselPlan, slideCount: number) {
  // Ajuster counts prompts/slides
  if (plan.prompts.length > slideCount) plan.prompts = plan.prompts.slice(0, slideCount);
  while (plan.prompts.length < slideCount) {
    plan.prompts.push("Minimalist gradient background with clean high-contrast center focus");
  }

  if (plan.slides.length > slideCount) plan.slides = plan.slides.slice(0, slideCount);
  while (plan.slides.length < slideCount) {
    plan.slides.push({
      type: "cta",
      title: "Découvre la suite",
      cta_primary: "En savoir plus",
    });
  }

  // Forcer structure & longueurs
  plan.slides = distributeTypes(plan.slides).map((s, idx) => {
    s.title = trimLen(s.title, 60); // + souple mais on valide plus bas pour les règles
    s.subtitle = trimLen(s.subtitle, 120);
    s.punchline = trimLen(s.punchline, 120);
    s.note = trimLen(s.note, 140);
    s.badge = trimLen(s.badge, 24);
    s.cta_primary = s.cta_primary ? trimLen(s.cta_primary, 24) : s.cta_primary;
    s.cta_secondary = s.cta_secondary ? trimLen(s.cta_secondary, 24) : s.cta_secondary;
    s.cta = s.cta ? trimLen(s.cta, 24) : s.cta;

    if (s.type === "problem" || s.type === "solution") {
      fixBullets(s);
    }
    return s;
  });

  // Règles critiques
  const errors: string[] = [];

  plan.slides.forEach((slide, i) => {
    const n = i + 1;
    const titleLen = (slide.title || "").length;

    if (slide.type === "hero") {
      if (!slide.cta_primary) {
        slide.cta_primary = "Découvrir";
        errors.push(`Slide ${n}/hero → cta_primary manquant (fallback ajouté)`);
      }
      if (titleLen < 10 || titleLen > 40) {
        slide.title = trimLen(slide.title || "Titre d'ouverture percutant", 40);
      }
    }

    if (slide.type === "problem" || slide.type === "solution") {
      if (!slide.bullets || slide.bullets.length < 3) {
        fixBullets(slide);
        errors.push(`Slide ${n}/${slide.type} → bullets < 3 (fallback complété)`);
      }
      if (titleLen < 10 || titleLen > 40) {
        slide.title = trimLen(slide.title || "Point clé", 40);
      }
    }

    if (slide.type === "cta") {
      if (!slide.cta_primary) {
        slide.cta_primary = "En savoir plus";
        errors.push(`Slide ${n}/cta → cta_primary manquant (fallback ajouté)`);
      }
      if (titleLen < 10 || titleLen > 40) {
        slide.title = trimLen(slide.title || "Passe à l'action", 40);
      }
    }
  });

  return { plan, errors };
}

function extractJSON(text: string) {
  // supporte un retour dans un bloc ```json ... ```
  const m = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  return JSON.parse(m ? m[1] : text);
}

function buildSystemPrompt(params: {
  slideCount: number;
  primary: string;
  secondary: string;
  brand: BrandKit | undefined;
  lang: "FR" | "EN";
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "yt-thumb";
  visualStyleCategory?: "background" | "character" | "product"; // ✅ NEW
}) {
  const { slideCount, primary, secondary, brand, lang, aspectRatio, visualStyleCategory } = params;

  const locale = lang === "FR";

  const head = locale
    ? `Tu es **Alfie**, expert carrousels social media. Ta mission : produire un *plan visuel* cohérent de ${slideCount} slides.`
    : `You are **Alfie**, social media carousel expert. Your task: produce a *visual plan* for ${slideCount} cohesive slides.`;

  const brandText = locale
    ? `Contexte Marque:
- Nom: ${brand?.name || "Non spécifié"}
- Secteur: ${brand?.niche || "Général"}
- Voix: ${brand?.voice || "Professionnelle et engageante"}
- Couleurs: ${primary}, ${secondary}`
    : `Brand context:
- Name: ${brand?.name || "Not specified"}
- Niche: ${brand?.niche || "General"}
- Voice: ${brand?.voice || "Professional and engaging"}
- Colors: ${primary}, ${secondary}`;

  const ratioLine = aspectRatio
    ? locale
      ? `⚙️ Ratio visuel à respecter: ${aspectRatio}.`
      : `⚙️ Respect aspect ratio: ${aspectRatio}.`
    : "";

  const styleReq = locale
    ? `STYLE (appliqué à toutes les slides) — obligatoire:
- Palette : ${primary} → ${secondary}
- Mood : pro, énergique, clair
- Composition : zones centrales à fort contraste, marges généreuses, rythme cohérent
- ⚠️ Les prompts visuels ne doivent PAS contenir de texte (ni lettres, ni logo).`
    : `STYLE (applies to all slides) — mandatory:
- Palette: ${primary} → ${secondary}
- Mood: professional, energetic, clear
- Composition: high-contrast center areas, generous margins, coherent rhythm
- ⚠️ Visual prompts MUST NOT include text (no letters, no logos).`;

  const contentReq = locale
    ? `CONTENU STRUCTURÉ — obligatoire:
- Slide 1 (type='hero'):
  - title (10–40 chars), cta_primary (5–20 chars, obligatoire), punchline/badge optionnels
- Slides 2–${slideCount - 1} (type='problem' ou 'solution'):
  - title (10–40 chars), bullets: 3–4 items (10–44 chars, actionnables)
- Slide ${slideCount} (type='cta'):
  - title (10–40 chars), cta_primary (obligatoire), subtitle/note optionnels`
    : `STRUCTURED CONTENT — mandatory:
- Slide 1 (type='hero'):
  - title (10–40 chars), cta_primary (5–20 chars required), optional punchline/badge
- Slides 2–${slideCount - 1} (type='problem' or 'solution'):
  - title (10–40 chars), bullets: 3–4 items (10–44 chars, actionable)
- Slide ${slideCount} (type='cta'):
  - title (10–40 chars), cta_primary (required), optional subtitle/note`;

  // ✅ Build prompt requirements based on visualStyleCategory
  let promptReq: string;
  let example: string;
  
  if (visualStyleCategory === 'character') {
    promptReq = locale
      ? `PROMPTS VISUELS — ${slideCount} entrées (une par slide):
- IMPORTANT: Chaque prompt doit décrire une scène avec un PERSONNAGE/MASCOTTE 3D style Pixar
- Le personnage doit être expressif, engageant, dans une action liée au contenu de la slide
- 1: Hero - personnage qui accueille/présente
- 2..${slideCount - 1}: personnage illustrant chaque point clé (actions différentes)
- ${slideCount}: personnage avec geste d'invitation/CTA
- Style: 3D Pixar, couleurs vibrantes, éclairage cinématique
- AUCUN texte dans l'image, pas de lettres, pas de logos.`
      : `VISUAL PROMPTS — ${slideCount} entries (one per slide):
- IMPORTANT: Each prompt must describe a scene with a 3D PIXAR-STYLE CHARACTER/MASCOT
- The character must be expressive, engaging, in an action related to the slide content
- 1: Hero - character welcoming/presenting
- 2..${slideCount - 1}: character illustrating each key point (different actions)
- ${slideCount}: character with inviting/CTA gesture
- Style: 3D Pixar, vibrant colors, cinematic lighting
- NO text in image, no letters, no logos.`;
    
    example = locale
      ? `EXEMPLE STYLE:
"Personnage 3D Pixar, couleurs ${primary}/${secondary}, éclairage cinématique, environnement moderne, expressions dynamiques."

EXEMPLE PROMPTS:
[
  "Mascotte 3D Pixar souriante, bras ouverts en signe de bienvenue, environnement bureau moderne lumineux, éclairage chaleureux",
  "Mascotte 3D pointant vers un graphique en hausse, expression enthousiaste, fond épuré avec accent ${primary}",
  "Mascotte 3D tenant un outil/objet professionnel, pose confiante, environnement de travail stylisé",
  "Mascotte 3D faisant un geste d'invitation (main tendue), sourire engageant, fond dynamique avec lueur ${secondary}"
]`
      : `STYLE EXAMPLE:
"3D Pixar character, ${primary}/${secondary} colors, cinematic lighting, modern environment, dynamic expressions."

PROMPTS EXAMPLE:
[
  "Smiling 3D Pixar mascot, open arms in welcoming gesture, bright modern office environment, warm lighting",
  "3D mascot pointing at rising chart, enthusiastic expression, clean background with ${primary} accent",
  "3D mascot holding professional tool/object, confident pose, stylized work environment",
  "3D mascot making inviting gesture (extended hand), engaging smile, dynamic background with ${secondary} glow"
]`;
  } else if (visualStyleCategory === 'product') {
    promptReq = locale
      ? `PROMPTS VISUELS — ${slideCount} entrées (une par slide):
- IMPORTANT: Chaque prompt doit décrire une scène de PHOTOGRAPHIE PRODUIT premium
- Le produit doit être mis en valeur dans un contexte lifestyle ou studio
- 1: Hero - produit en vedette, présentation majestueuse
- 2..${slideCount - 1}: produit en contexte d'utilisation
- ${slideCount}: produit avec mise en scène call-to-action
- Style: photo studio haute qualité, éclairage professionnel
- AUCUN texte dans l'image, pas de lettres, pas de logos.`
      : `VISUAL PROMPTS — ${slideCount} entries (one per slide):
- IMPORTANT: Each prompt must describe a PREMIUM PRODUCT PHOTOGRAPHY scene
- The product should be showcased in lifestyle or studio context
- 1: Hero - product as star, majestic presentation
- 2..${slideCount - 1}: product in usage context
- ${slideCount}: product with call-to-action staging
- Style: high-quality studio photography, professional lighting
- NO text in image, no letters, no logos.`;
    
    example = locale
      ? `EXEMPLE STYLE:
"Photographie produit premium, palette ${primary}/${secondary}, éclairage studio, esthétique moderne épurée."

EXEMPLE PROMPTS:
[
  "Produit en vedette sur fond épuré, éclairage studio dramatique, reflets subtils, composition centrée",
  "Produit en contexte d'utilisation lifestyle, environnement élégant, lumière naturelle douce",
  "Gros plan produit avec détails visibles, fond dégradé ${primary}, éclairage latéral",
  "Produit avec éléments de packaging, mise en scène invitant à l'achat, ambiance premium"
]`
      : `STYLE EXAMPLE:
"Premium product photography, ${primary}/${secondary} palette, studio lighting, clean modern aesthetic."

PROMPTS EXAMPLE:
[
  "Product as hero on clean background, dramatic studio lighting, subtle reflections, centered composition",
  "Product in lifestyle usage context, elegant environment, soft natural light",
  "Product close-up with visible details, ${primary} gradient background, side lighting",
  "Product with packaging elements, purchase-inviting staging, premium ambiance"
]`;
  } else {
    // Background mode (original behavior)
    promptReq = locale
      ? `PROMPTS VISUELS — ${slideCount} entrées (une par slide):
- 1: ouverture (hero), ${slideCount}: conclusion/CTA
- 2..${slideCount - 1}: scènes à thème unique (arrière-plans/ambiances)
- Toujours décrire **la scène visuelle seulement**. AUCUN TEXTE.`
      : `VISUAL PROMPTS — ${slideCount} entries (one per slide):
- 1: opening (hero), ${slideCount}: closing/CTA
- 2..${slideCount - 1}: single-concept scenes (backgrounds/ambience)
- Always describe **visual scene only**. NO TEXT.`;

    example = locale
      ? `EXEMPLE STYLE:
"Dégradés ${primary}→${secondary}, formes géométriques en accent, centre à fort contraste, minimalisme moderne, rythme régulier."

EXEMPLE PROMPTS:
[
  "Gradient dynamique avec formes abstraites (ouverture)",
  "Fond uni avec motif géométrique subtil",
  "Dégradé minimaliste avec focus central",
  "Scène énergique pour appel à l'action (fermeture)"
]`
      : `STYLE EXAMPLE:
"${primary}→${secondary} gradients, geometric accent shapes, high-contrast center, modern minimalist, steady rhythm."

PROMPTS EXAMPLE:
[
  "Dynamic gradient with abstract shapes (opening)",
  "Clean solid background with subtle geometric pattern",
  "Minimalist gradient with center focus",
  "Energetic CTA mood background (closing)"
]`;
  }

  const outputFormat = `Output JSON strictly:
{
  "style": "string",
  "prompts": [ "${locale ? "scene description without text" : "scene description without text"}", ... ${slideCount} items ],
  "slides": [
    { "type": "hero", "title": "...", "cta_primary": "...", "punchline": "optional", "badge": "optional" },
    { "type": "problem", "title": "...", "bullets": ["...", "...", "..."] },
    ...,
    { "type": "cta", "title": "...", "cta_primary": "...", "subtitle": "optional", "note": "optional" }
  ]
}`;

  return `${head}

${ratioLine}

${brandText}

${styleReq}

${contentReq}

${promptReq}

${example}

${outputFormat}
`;
}

function responseSchema(slideCount: number) {
  return {
    type: "object",
    properties: {
      style: { type: "string", description: "Global visual style for all slides" },
      prompts: {
        type: "array",
        items: { type: "string" },
        minItems: slideCount,
        maxItems: slideCount,
        description: `Array of ${slideCount} visual scene descriptions (no text overlay)`,
      },
      slides: {
        type: "array",
        minItems: slideCount,
        maxItems: slideCount,
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["hero", "problem", "solution", "impact", "cta"] },
            title: { type: "string" },
            subtitle: { type: "string" },
            punchline: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            cta: { type: "string" },
            cta_primary: { type: "string" },
            cta_secondary: { type: "string" },
            note: { type: "string" },
            badge: { type: "string" },
            kpis: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  delta: { type: "string" },
                },
                required: ["label", "delta"],
              },
            },
          },
          required: ["type", "title"],
        },
        description: `Array of ${slideCount} structured slide content objects`,
      },
    },
    required: ["style", "prompts", "slides"],
    additionalProperties: false,
  };
}

// ---------------------------
// Handler
// ---------------------------
Deno.serve(async (req) => {
  console.log("[alfie-plan-carousel] v3.0.0 invoked");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as InputBodyNew & InputBodyLegacy;

    // Compatibilité entrée
    const rawPrompt = body.prompt || body.topic;
    let slideCount = clamp(toInt(body.slideCount ?? body.numSlides ?? 5, 5), MIN_SLIDES, MAX_SLIDES);

    const brandKit: BrandKit | undefined = body.brandKit || (body.brandVoice ? { voice: body.brandVoice } : undefined);

    const lang = normalizeLanguage((body as any).language);
    const aspectRatio = (body as any).aspectRatio as InputBodyNew["aspectRatio"] | undefined;
    const visualStyleCategory = body.visualStyleCategory || 'character';
    const backgroundOnly = body.backgroundOnly === true;
    
    console.log(`[alfie-plan-carousel] visualStyleCategory: ${visualStyleCategory}, backgroundOnly: ${backgroundOnly}`);

    if (!rawPrompt) {
      return json({ error: "Missing prompt/topic" }, 400);
    }

    // ✅ NEW: Check for pre-parsed brief or parse from prompt
    let parsedBrief: ParsedBrief | null = body.parsedBrief || null;
    if (!parsedBrief && rawPrompt) {
      parsedBrief = parseBrief(rawPrompt, slideCount);
      console.log(`[alfie-plan-carousel] Parsed brief: hasStructuredSlides=${parsedBrief.hasStructuredSlides}, globalConstraints=${JSON.stringify(parsedBrief.globalConstraints)}, slides=${parsedBrief.slides.length}`);
    }

    // ✅ DIRECT MODE: If user provided structured slides, use them directly
    if (parsedBrief?.hasStructuredSlides && parsedBrief.slides.length > 0) {
      console.log(`[alfie-plan-carousel] ✅ DIRECT MODE: Using ${parsedBrief.slides.length} slides from user brief`);
      
      // Build slides from parsed brief
      const directSlides: SlideContent[] = parsedBrief.slides.map((s, idx) => ({
        type: (idx === 0 ? "hero" : idx === parsedBrief!.slides.length - 1 ? "cta" : "problem") as SlideType,
        title: s.title || `Slide ${idx + 1}`,
        subtitle: s.subtitle,
        punchline: s.body,
        bullets: s.bullets,
        cta_primary: s.cta,
        // ✅ Attach constraints for downstream use
        _constraints: s.constraints,
        _allowMascot: s.allowMascot,
      } as SlideContent & { _constraints?: string[]; _allowMascot?: boolean }));

      // Build visual prompts with constraints
      const styleFromBrief = buildStylePrompt(parsedBrief.globalStyle);
      const directPrompts = directSlides.map((slide, idx) => {
        const slideData = parsedBrief!.slides[idx];
        const constraintStr = buildConstraintPrompt(
          [...parsedBrief!.globalConstraints, ...slideData.constraints],
          slideData.allowMascot
        );
        
        return forceNoTextPrompt(
          `${styleFromBrief}. Slide ${idx + 1}. ${constraintStr}`,
          slideData.allowMascot ? visualStyleCategory : 'background'
        );
      });

      return json({
        style: styleFromBrief || "User-defined style",
        prompts: directPrompts,
        slides: directSlides.map((s, idx) => ({
          ...s,
          visualPrompt: directPrompts[idx],
          constraints: parsedBrief!.slides[idx].constraints,
          allowMascot: parsedBrief!.slides[idx].allowMascot,
        })),
        meta: {
          slideCount: directSlides.length,
          aspectRatio: aspectRatio ?? null,
          language: lang,
          visualStyleCategory,
          directMode: true, // ✅ Flag indicating user-provided content was used
          globalStyle: parsedBrief.globalStyle,
          globalConstraints: parsedBrief.globalConstraints,
          brand: {
            name: brandKit?.name ?? null,
            niche: brandKit?.niche ?? null,
            voice: brandKit?.voice ?? null,
            palette: brandKit?.palette ?? [],
          },
          notes: [],
          version: "v3.0.0",
        },
      });
    }

    // ✅ GENERATION MODE: No structured slides, generate via AI
    const [primary, secondary] = first2Palette(brandKit?.palette);

    // --- System prompt (only for AI generation mode)
    const systemPrompt = buildSystemPrompt({
      slideCount,
      primary,
      secondary,
      brand: brandKit,
      lang,
      aspectRatio,
      visualStyleCategory: backgroundOnly ? 'background' : visualStyleCategory,
    });

    if (!LOVABLE_API_KEY) {
      console.error("[alfie-plan-carousel] ❌ Missing LOVABLE_API_KEY");
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    // --- Appel IA avec structured output
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawPrompt },
        ],
        temperature: 0.5,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "carousel_plan",
            schema: responseSchema(slideCount),
          },
        },
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      const errText = await aiRes.text().catch(() => "");
      console.error("[alfie-plan-carousel] AI error:", status, errText);

      if (status === 429) return json({ error: "Rate limits exceeded, please try again later." }, 429);
      if (status === 402)
        return json({ error: "Payment required, please add funds to your Lovable AI workspace." }, 402);
      return json({ error: "AI gateway error", details: errText.slice(0, 3000) }, status);
    }

    const data = await aiRes.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return json({ error: "AI returned an empty response" }, 502);
    }

    let plan: CarouselPlan;
    try {
      plan = extractJSON(rawContent) as CarouselPlan;
    } catch (e) {
      console.warn("[alfie-plan-carousel] JSON parse fallback:", e);
      // Fallback ultra minimal si jamais
      plan = {
        style: `Gradients ${primary}→${secondary}, modern minimalist, high-contrast center.`,
        prompts: Array.from({ length: slideCount }, (_, i) =>
          forceNoTextPrompt(
            i === 0
              ? "Dynamic gradient with abstract shapes (opening)"
              : i === slideCount - 1
                ? "Energetic background hinting at call-to-action (closing)"
                : "Clean background with subtle geometric rhythm",
          ),
        ),
        slides: [
          { type: "hero" as SlideType, title: "Titre d'ouverture", cta_primary: "Découvrir" },
          ...Array.from({ length: Math.max(0, slideCount - 2) }, (): SlideContent => ({
            type: "problem" as SlideType,
            title: "Point clé",
            bullets: ["Bénéfice 1", "Bénéfice 2", "Bénéfice 3"],
          })),
          { type: "cta" as SlideType, title: "Passe à l'action", cta_primary: "En savoir plus" },
        ],
      };
    }

    // Sanitize prompts to enforce "no text" (only for background mode)
    plan.prompts = (plan.prompts || []).map(p => forceNoTextPrompt(p, visualStyleCategory));

    // Hard validations + structure + longueurs
    const { plan: fixedPlan, errors } = applyHardValidations(plan, slideCount);

    // ✅ NEW: Attach visualPrompt to each slide for downstream consumption
    const slidesWithPrompts = fixedPlan.slides.map((slide, idx) => ({
      ...slide,
      visualPrompt: fixedPlan.prompts[idx] || fixedPlan.prompts[0] || 'Professional modern scene',
    }));

    console.log("[alfie-plan-carousel] ✅ Plan generated:", {
      slides: slidesWithPrompts.length,
      prompts: fixedPlan.prompts.length,
      visualStyleCategory,
      errors,
    });

    return json({
      style: trimLen(fixedPlan.style, 1200),
      prompts: fixedPlan.prompts,
      slides: slidesWithPrompts, // ✅ Each slide now has visualPrompt attached
      meta: {
        slideCount,
        aspectRatio: aspectRatio ?? null,
        language: lang,
        visualStyleCategory, // ✅ Include in meta for debugging
        brand: {
          name: brandKit?.name ?? null,
          niche: brandKit?.niche ?? null,
          voice: brandKit?.voice ?? null,
          palette: brandKit?.palette ?? [],
        },
        notes: errors,
        version: "v2.2.0", // ✅ Version bump
      },
    });
  } catch (err: any) {
    console.error("[alfie-plan-carousel] 💥 Error:", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});
