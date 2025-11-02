import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { CarouselGlobals, SlideContent, CarouselPlan, DEFAULT_GLOBALS, CHAR_LIMITS } from "../_shared/carouselGlobals.ts";
import { lintCarousel, generateCorrectionPrompt } from "../_shared/carouselLinter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= HELPERS DE PARSING ROBUSTES =============

function extractJsonBlock(s: string): string | null {
  // Enlève les ```json ... ``` éventuels
  const unFenced = s.replace(/```(?:json)?/gi, "```").replace(/```/g, "");
  // Récupère le plus GRAND bloc {...} pour éviter les préfaces / épilogues
  let depth = 0, start = -1, best: {i:number; j:number} | null = null;
  for (let i=0; i<unFenced.length; i++){
    const c = unFenced[i];
    if (c === "{") { if (depth===0) start = i; depth++; }
    else if (c === "}") { depth--; if (depth===0 && start>=0) { const cand={i:start,j:i+1}; if (!best || (cand.j-cand.i)>(best.j-best.i)) best=cand; } }
  }
  return best ? unFenced.slice(best.i, best.j) : null;
}

function stripTrailingCommas(jsonLike: string): string {
  // Supprime les virgules traînantes dans objets/arrays
  return jsonLike
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201C\u201D]/g, '"') // guillemets typographiques → "
    .replace(/[\u2018\u2019]/g, "'"); // apostrophes typographiques
}

function tryParse(jsonStr: string): any {
  try { return JSON.parse(jsonStr); } catch {}
  // fallback JSON5 léger : autorise trailing commas déjà supprimées, et comments
  try {
    const cleaned = jsonStr
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(cleaned);
  } catch { return null; }
}

interface PlanRequest {
  prompt: string;
  brandKit?: {
    name?: string;
    palette?: string[];
    voice?: string;
  };
  slideCount: number;
}

// ============= AUTO-CORRECTION HELPER (hors scope pour réutilisation) =============
function autoCorrectPlan(rawPlan: any, requestedSlideCount: number): CarouselPlan {
  const clamp = (s?: string, min=0, max=120) =>
    (typeof s === "string" ? s.trim().slice(0, max) : "").slice(min);
  const arr = (a: any) => Array.isArray(a) ? a : [];
  
  // Si pas de slides valides, générer un fallback complet
  const rawSlides = arr(rawPlan?.slides);
  const hasValidSlides = rawSlides.length > 0 && rawSlides.some((s: any) => s?.title);
  
  if (!hasValidSlides) {
    console.log('[AutoCorrect] No valid slides, generating complete fallback');
    const fallbackGlobals = rawPlan?.globals || DEFAULT_GLOBALS;
    return {
      globals: fallbackGlobals,
      slides: requestedSlideCount === 5 ? [
        { type: 'hero', title: 'Créez des visuels cohérents', subtitle: 'L\'IA qui garde vos créations on-brand', punchline: 'Cohérence garantie', badge: 'Cohérence 95/100', cta_primary: fallbackGlobals.cta },
        { type: 'problem', title: 'Le défi de la cohérence', bullets: ['Visuels incohérents', 'Validations manuelles', 'Marque diluée'] },
        { type: 'solution', title: fallbackGlobals.promise, bullets: ['IA garde-fous', 'Variantes cohérentes', 'Workflows accélérés'] },
        { type: 'impact', title: 'Résultats mesurables', kpis: [{ label: 'Cohérence', delta: '+92%' }, { label: 'Temps', delta: '-60%' }, { label: 'Production', delta: '×3' }] },
        { type: 'cta', title: 'Prêt à essayer ?', subtitle: 'Rejoignez les équipes créatives', cta_primary: fallbackGlobals.cta, cta_secondary: 'En savoir plus', note: 'Accès anticipé disponible' }
      ] : requestedSlideCount === 3 ? [
        { type: 'hero', title: 'Visuels cohérents', subtitle: fallbackGlobals.promise, cta_primary: fallbackGlobals.cta },
        { type: 'solution', title: 'Solution complète', bullets: ['Cohérence garantie', 'Créations rapides', 'Workflows simples'] },
        { type: 'cta', title: fallbackGlobals.cta, cta_primary: fallbackGlobals.cta, note: 'Accès anticipé disponible' }
      ] : Array(requestedSlideCount).fill(null).map((_, i) => ({
        type: (i === 0 ? 'hero' : i === requestedSlideCount-1 ? 'cta' : 'solution') as 'hero' | 'cta' | 'solution',
        title: i === 0 ? 'Créez avec cohérence' : `Slide ${i + 1}`,
        subtitle: i === 0 ? fallbackGlobals.promise : ''
      })),
      captions: Array(Math.min(requestedSlideCount, 3)).fill('').map((_, i) => `Post ${i + 1} #coherence`)
    };
  }
  
  // Normalisation avec garde-fous
  const slides = rawSlides.map((s: any, i: number) => {
    const normalized: any = {
      type: s?.type ?? (i===0 ? "hero" : i===rawSlides.length-1 ? "cta" : "solution"),
      title: clamp(s?.title, 1, CHAR_LIMITS.title.max),
      subtitle: clamp(s?.subtitle, 0, CHAR_LIMITS.subtitle.max),
      punchline: clamp(s?.punchline, 0, CHAR_LIMITS.punchline.max),
      bullets: arr(s?.bullets).map((b: any) => clamp(String(b), 0, CHAR_LIMITS.bullet.max)).slice(0, 6),
      cta_primary: clamp(s?.cta ?? s?.cta_primary, 0, CHAR_LIMITS.cta.max),
      cta_secondary: clamp(s?.cta_secondary, 0, CHAR_LIMITS.cta.max),
      badge: clamp(s?.badge, 0, 30),
      note: clamp(s?.note, 0, CHAR_LIMITS.note.max),
    };
    
    // Fix KPIs: add units if missing
    if (s?.kpis) {
      normalized.kpis = arr(s.kpis).map((kpi: any) => ({
        label: clamp(kpi?.label, 0, CHAR_LIMITS.kpi_label.max),
        delta: (() => {
          const d = clamp(kpi?.delta, 0, CHAR_LIMITS.kpi_delta.max);
          return /[%×]|pts/.test(d) ? d : d + '%';
        })()
      }));
    }
    
    // Force CTA consistency (R2)
    if (normalized.type === 'hero' || normalized.type === 'cta') {
      if (!normalized.cta_primary || normalized.cta_primary.length > CHAR_LIMITS.cta.max) {
        normalized.cta_primary = rawPlan?.globals?.cta || DEFAULT_GLOBALS.cta;
      }
    }
    
    return normalized;
  });
  
  return {
    globals: rawPlan?.globals || DEFAULT_GLOBALS,
    slides,
    captions: arr(rawPlan?.captions).map((c: any) => clamp(String(c), 0, 200))
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, brandKit, slideCount }: PlanRequest = await req.json();

    console.log('[Plan] Request:', { prompt, slideCount, brandName: brandKit?.name });

    if (!prompt || slideCount < 1 || slideCount > 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: prompt required and slideCount must be 1-10' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Extraire ou construire les globals
    const globals: CarouselGlobals = {
      ...DEFAULT_GLOBALS,
      audience: brandKit?.voice?.includes('professionnel') ? 'Directeurs Marketing & studios internes' : DEFAULT_GLOBALS.audience,
    };

    // Construire le contexte de marque
    let brandContext = '';
    if (brandKit) {
      brandContext = `\nBrand Context:\n- Brand Name: ${brandKit.name || 'N/A'}\n- Colors: ${brandKit.palette?.join(', ') || 'N/A'}\n- Voice: ${brandKit.voice || 'professional'}`;
    }

    // Définir les types de slides en fonction du slideCount
    const slideTypes = slideCount === 5 
      ? ['hero', 'problem', 'solution', 'impact', 'cta']
      : slideCount === 3
      ? ['hero', 'solution', 'cta']
      : Array(slideCount).fill('variant');

    // Prompt système enrichi avec globals et limites de caractères
    const systemPrompt = `You are a French carousel content planner with strict editorial guidelines.

GLOBALS (MUST BE RESPECTED):
- Audience: ${globals.audience}
- Promesse centrale: ${globals.promise}
- CTA canonique: ${globals.cta}
- Terminologie obligatoire: ${globals.terminology.join(', ')}
- Mots INTERDITS: ${globals.banned.join(', ')}

CRITICAL FRENCH SPELLING RULES:
- Use PERFECT French spelling with proper accents: é, è, ê, à, ç, ù, etc.
- Common corrections: "puisence" → "puissance", "vidéos captatives" → "vidéos captivantes", "integration" → "intégration"

CHARACTER LIMITS (STRICT):
- title: 10-40 caractères
- subtitle: 20-70 caractères
- punchline: 20-60 caractères
- bullet: 10-44 caractères
- cta: 8-22 caractères
- kpi_label: 5-22 caractères
- kpi_delta: 2-8 caractères (avec unité %, pts, ou ×)

RESPONSE FORMAT (JSON STRICT):
{
  "globals": {
    "audience": "${globals.audience}",
    "promise": "${globals.promise}",
    "cta": "${globals.cta}",
    "terminology": ${JSON.stringify(globals.terminology)},
    "banned": ${JSON.stringify(globals.banned)}
  },
  "slides": [
    ${slideTypes.map((type, i) => `{
      "type": "${type}",
      "title": "...",
      ${type === 'hero' ? '"subtitle": "...", "punchline": "...", "badge": "Cohérence 92/100", "cta_primary": "' + globals.cta + '",' : ''}
      ${type === 'problem' || type === 'solution' ? '"bullets": ["...", "...", "..."],' : ''}
      ${type === 'impact' ? '"kpis": [{"label": "...", "delta": "-60%"}],' : ''}
      ${type === 'cta' ? '"subtitle": "...", "cta_primary": "' + globals.cta + '", "cta_secondary": "...", "note": "...",' : ''}
    }`).join(',\n    ')}
  ],
  "captions": ["Légende post 1...", "Légende post 2..."]
}

EDITORIAL RULES (R1-R8):
R1: Réutiliser la promesse "${globals.promise}" en slide solution ou cta
R2: CTA identique sur hero et cta = "${globals.cta}"
R3: Utiliser ≥1 terme du glossaire par slide, 0 mot banni
R4: Pas de !!, pas de MAJUSCULES intégrales
R5: Unités cohérentes dans KPIs (%, pts, ×)
R6: Respecter les limites de caractères
R7: T2 (problème) → T3 (solution) → T4 (impact) cohérents
R8: Pas d'hyperboles ("révolutionnaire", "incroyable")
${brandContext}`;

    let userMessage = `Create a ${slideCount}-slide carousel plan for:\n\n${prompt}\n\nRespect ALL globals, character limits, and editorial rules.`;

    // Génération avec cycle de validation et correction
    let plan: CarouselPlan | null = null;
    let attempt = 0;
    const maxAttempts = 3;

    while (!plan && attempt < maxAttempts) {
      attempt++;
      console.log(`[Plan] Attempt ${attempt}/${maxAttempts}...`);

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Lovable AI error:', aiResponse.status, errorText);
        throw new Error(`AI planning failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content returned from AI');
      }

      // Extraction + parsing ROBUSTE
      const chunk = extractJsonBlock(content) ?? content.trim();
      const cleaned = stripTrailingCommas(chunk);
      const parsedPlan = tryParse(cleaned);
      
      if (!parsedPlan) {
        console.warn(`[Plan] Parse failed on attempt ${attempt}, will retry or fallback`);
        continue;
      }

      // Valider avec le linter
      const lintResult = lintCarousel(parsedPlan.globals || globals, parsedPlan.slides);

      if (lintResult.valid) {
        console.log(`[Plan] ✅ Validation passed!`);
        console.log('[Plan] Generated plan:', JSON.stringify(parsedPlan, null, 2));
        if (lintResult.warnings.length > 0) {
          console.log(`[Plan] ⚠️ Warnings: ${lintResult.warnings.join(', ')}`);
        }
        plan = parsedPlan;
      } else {
        console.log(`[Plan] ❌ Validation failed:`, lintResult.errors);
        
        // Apply auto-correction RENFORCÉE
        console.log(`[Plan] Applying reinforced auto-correction...`);
        const autoCorrected = autoCorrectPlan(parsedPlan, slideCount);
        const autoLintResult = lintCarousel(autoCorrected.globals || globals, autoCorrected.slides);
        
        if (autoLintResult.valid) {
          console.log(`[Plan] ✅ Auto-correction successful!`);
          plan = autoCorrected;
        } else if (attempt < maxAttempts) {
          console.log(`[Plan] Auto-correction insufficient, retrying with AI...`);
          const correctionPrompt = generateCorrectionPrompt(lintResult.errors, parsedPlan);
          userMessage = correctionPrompt;
        }
      }
    }

    if (!plan) {
      // Dernier filet : renvoyer un fallback propre via autoCorrectPlan (200 OK, jamais 4xx)
      console.log(`[Plan] All attempts failed, generating COMPLETE fallback via autoCorrect...`);
      plan = autoCorrectPlan({}, slideCount);
      console.log('[Plan] Fallback plan generated:', JSON.stringify(plan, null, 2));
    }

    console.log(`Successfully created validated plan for ${slideCount} slides`);

    return new Response(JSON.stringify({ plan, fallback: !plan.slides?.[0]?.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in alfie-plan-carousel:', error);
    // Dernier filet : même en cas d'erreur fatale, renvoyer un fallback 200 OK
    const { slideCount } = await req.json().catch(() => ({ slideCount: 5 }));
    const fallbackPlan = autoCorrectPlan({}, slideCount || 5);
    return new Response(
      JSON.stringify({ plan: fallbackPlan, fallback: true, error: error.message }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
