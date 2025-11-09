// functions/alfie-plan-carousel/index.ts
// v2.1.0 — Planificateur de carrousel robuste (rétro-compat, validations, structured output)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ---------------------------
// CORS
// ---------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  language?: "FR" | "EN";
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

function forceNoTextPrompt(p: string) {
  // ajoute des garde-fous pour empêcher la génération de texte intégré
  return `${p.trim()}. No text, no typography, no letters, no logos, no watermark. Background/scene only.`;
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
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
}) {
  const { slideCount, primary, secondary, brand, lang, aspectRatio } = params;

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

  const promptReq = locale
    ? `PROMPTS VISUELS — ${slideCount} entrées (une par slide):
- 1: ouverture (hero), ${slideCount}: conclusion/CTA
- 2..${slideCount - 1}: scènes à thème unique (arrière-plans/ambiances)
- Toujours décrire **la scène visuelle seulement**. AUCUN TEXTE.`
    : `VISUAL PROMPTS — ${slideCount} entries (one per slide):
- 1: opening (hero), ${slideCount}: closing/CTA
- 2..${slideCount - 1}: single-concept scenes (backgrounds/ambience)
- Always describe **visual scene only**. NO TEXT.`;

  const example = locale
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
serve(async (req) => {
  console.log("[alfie-plan-carousel] v2.1.0 invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as InputBodyNew & InputBodyLegacy;

    // Compatibilité entrée
    const rawPrompt = body.prompt || body.topic;
    let slideCount = clamp(toInt(body.slideCount ?? body.numSlides ?? 5, 5), MIN_SLIDES, MAX_SLIDES);

    const brandKit: BrandKit | undefined = body.brandKit || (body.brandVoice ? { voice: body.brandVoice } : undefined);

    const lang = normalizeLanguage((body as any).language);
    const aspectRatio = (body as any).aspectRatio as InputBodyNew["aspectRatio"] | undefined;

    if (!rawPrompt) {
      return json({ error: "Missing prompt/topic" }, 400);
    }

    const [primary, secondary] = first2Palette(brandKit?.palette);

    // --- System prompt
    const systemPrompt = buildSystemPrompt({
      slideCount,
      primary,
      secondary,
      brand: brandKit,
      lang,
      aspectRatio,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
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

    // Sanitize prompts to enforce "no text"
    plan.prompts = (plan.prompts || []).map(forceNoTextPrompt);

    // Hard validations + structure + longueurs
    const { plan: fixedPlan, errors } = applyHardValidations(plan, slideCount);

    console.log("[alfie-plan-carousel] ✅ Plan generated:", {
      slides: fixedPlan.slides.length,
      prompts: fixedPlan.prompts.length,
      errors,
    });

    return json({
      style: trimLen(fixedPlan.style, 1200),
      prompts: fixedPlan.prompts,
      slides: fixedPlan.slides,
      meta: {
        slideCount,
        aspectRatio: aspectRatio ?? null,
        language: lang,
        brand: {
          name: brandKit?.name ?? null,
          niche: brandKit?.niche ?? null,
          voice: brandKit?.voice ?? null,
          palette: brandKit?.palette ?? [],
        },
        notes: errors,
        version: "v2.1.0",
      },
    });
  } catch (err: any) {
    console.error("[alfie-plan-carousel] 💥 Error:", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});
