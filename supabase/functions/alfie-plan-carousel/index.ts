import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { CarouselGlobals, SlideContent, CarouselPlan, DEFAULT_GLOBALS } from "../_shared/carouselGlobals.ts";
import { lintCarousel, generateCorrectionPrompt } from "../_shared/carouselLinter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanRequest {
  prompt: string;
  brandKit?: {
    name?: string;
    palette?: string[];
    voice?: string;
  };
  slideCount: number;
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
    const maxAttempts = 2;

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

      // Extraire le JSON
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedPlan = JSON.parse(jsonContent);

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
        
        if (attempt < maxAttempts) {
          console.log(`[Plan] Retrying with corrections...`);
          const correctionPrompt = generateCorrectionPrompt(lintResult.errors, parsedPlan);
          // Injecter la correction dans le userMessage pour la prochaine tentative
          userMessage = correctionPrompt;
        } else {
          throw new Error(`Plan validation failed after ${maxAttempts} attempts: ${lintResult.errors.join(', ')}`);
        }
      }
    }

    if (!plan) {
      throw new Error('Failed to generate valid plan');
    }

    console.log(`Successfully created validated plan for ${slideCount} slides`);

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in alfie-plan-carousel:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString() 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
