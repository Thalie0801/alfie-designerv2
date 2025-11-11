import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrandKit {
  name?: string;
  palette?: string[];
  voice?: string;
  niche?: string;
}

interface SlideContent {
  type: 'hero' | 'problem' | 'solution' | 'impact' | 'cta';
  title: string;
  subtitle?: string;
  punchline?: string;
  bullets?: string[];
  cta?: string;
  cta_primary?: string;
  cta_secondary?: string;
  note?: string;
  badge?: string;
  kpis?: Array<{ label: string; delta: string }>;
}

interface SimplifiedCarouselPlan {
  style: string;
  prompts: string[];
  slides: SlideContent[];
}

serve(async (req) => {
  console.log('[alfie-plan-carousel] v1.0.0 - Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // ✅ COMPATIBILITÉ RÉTROACTIVE : accepter les deux formats
    // Format ancien (de alfie-job-worker non redéployé): topic, numSlides, brandVoice
    // Format nouveau (de alfie-job-worker redéployé): prompt, slideCount, brandKit
    const prompt = body.prompt || body.topic;
    const slideCount = body.slideCount || body.numSlides;
    const brandKit = body.brandKit || (body.brandVoice ? { voice: body.brandVoice } : undefined);
    
    console.log('[alfie-plan-carousel] Received format:', {
      hasPrompt: !!body.prompt,
      hasTopic: !!body.topic,
      hasSlideCount: !!body.slideCount,
      hasNumSlides: !!body.numSlides,
      hasBrandKit: !!body.brandKit,
      hasBrandVoice: !!body.brandVoice
    });

    if (!prompt || !slideCount) {
      throw new Error('Missing prompt/topic or slideCount/numSlides');
    }

    const brandInfo = brandKit as BrandKit;
    
    // Extraire les couleurs de la palette
    const primary_color = brandInfo?.palette?.[0] || 'vibrant blue';
    const secondary_color = brandInfo?.palette?.[1] || 'warm orange';
    
    // Construire le prompt système RENFORCÉ avec MANDATORY fields
    const systemPrompt = `You are Alfie, a social media carousel expert.

Your task: Generate a cohesive visual plan for ${slideCount} carousel slides.

OUTPUT FORMAT:
- "style": A single, detailed visual style description that applies to ALL slides
- "prompts": An array of ${slideCount} scene descriptions (one per slide)
- "slides": An array of ${slideCount} structured slide content objects with text content

STYLE REQUIREMENTS:
- Must be cohesive across all ${slideCount} slides
- Use brand colors: ${primary_color}, ${secondary_color}
- Specify: color palette, mood, composition rhythm, spacing
- Example: "Modern gradient backgrounds using ${primary_color} to ${secondary_color}. Clean minimalist composition with 80px margins. High contrast center areas for text. Consistent geometric patterns."

PROMPT REQUIREMENTS:
Each prompt describes the VISUAL SCENE for that slide:
- Slide 1 (hero): Eye-catching opening scene
- Slides 2-${slideCount-1}: Content scenes (one concept per slide)
- Slide ${slideCount}: Strong closing/CTA scene
- Keep prompts visual and descriptive (not text-heavy)
- NO TEXT, NO TYPOGRAPHY in the prompts (backgrounds only)

BRAND CONTEXT:
- Name: ${brandInfo?.name || 'Not specified'}
- Niche: ${brandInfo?.niche || 'General'}
- Voice: ${brandInfo?.voice || 'Professional and engaging'}

🔴 CRITICAL SLIDES STRUCTURE REQUIREMENTS (MANDATORY):

Slide 1 (type='hero') MUST include:
- title (10-40 chars)
- cta_primary (5-20 chars) - MANDATORY, no exceptions
- punchline (optional, 30-80 chars if provided)
- badge (optional, 5-15 chars if provided)

Slides 2-${slideCount-1} (type='problem' or 'solution') MUST include:
- title (10-40 chars)
- bullets: MANDATORY array of exactly 3-4 bullet points (each 10-44 chars)
  → NO EMPTY bullets array
  → Each bullet MUST be actionable and specific
  → Example: ["Réduis ton temps de création de 70%", "Génère 10x plus de contenus", "Automatise ta stratégie social media"]

Last slide (type='cta') MUST include:
- title (10-40 chars)
- cta_primary (5-20 chars) - MANDATORY
- subtitle (optional, 30-80 chars if provided)
- note (optional, 30-100 chars if provided)

⚠️ VALIDATION RULES:
- Every 'hero' slide → MUST have cta_primary
- Every 'problem'/'solution' slide → MUST have bullets array with 3-4 items minimum
- Every 'cta' slide → MUST have cta_primary
- NO slide should have empty/missing mandatory fields

Example output (RESPECT THIS STRUCTURE):
{
  "style": "Vibrant gradient backgrounds blending ${primary_color} to ${secondary_color}. Modern, minimalist composition with high contrast center areas. Geometric shapes as accents. Professional and energetic mood.",
  "prompts": [
    "Dynamic gradient opening scene with abstract shapes, high energy",
    "Clean solid background with subtle geometric pattern",
    "Minimalist gradient with focus on center area",
    "Bold energetic scene for call-to-action mood"
  ],
  "slides": [
    {
      "type": "hero",
      "title": "Transforme ton marketing en 2025",
      "punchline": "L'IA qui génère tes contenus automatiquement",
      "cta_primary": "Commencer gratuitement",
      "badge": "Nouveau"
    },
    {
      "type": "problem",
      "title": "Pourquoi tu perds du temps ?",
      "bullets": [
        "Création manuelle = 5h par semaine gaspillées",
        "Manque d'idées récurrentes et blocages créatifs",
        "Aucune cohérence visuelle entre tes posts",
        "ROI difficile à mesurer sans analytics"
      ]
    },
    {
      "type": "solution",
      "title": "Notre solution IA tout-en-un",
      "bullets": [
        "Génération automatique de visuels en 30 secondes",
        "Templates optimisés pour chaque réseau social",
        "Brand kit personnalisé appliqué partout"
      ]
    },
    {
      "type": "cta",
      "title": "Rejoins 10 000+ créateurs satisfaits",
      "subtitle": "Essai gratuit de 14 jours sans engagement",
      "cta_primary": "Démarrer maintenant",
      "note": "Aucune carte bancaire requise. Installation en 2 minutes."
    }
  ]
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Schema de réponse structurée
    const responseSchema = {
      type: "object",
      properties: {
        style: {
          type: "string",
          description: "Global visual style for all slides"
        },
        prompts: {
          type: "array",
          items: { type: "string" },
          description: `Array of ${slideCount} visual scene descriptions`
        },
        slides: {
          type: "array",
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
                    delta: { type: "string" }
                  }
                }
              }
            },
            required: ["type", "title"]
          },
          description: `Array of ${slideCount} structured slide content objects`
        }
      },
      required: ["style", "prompts", "slides"]
    };

    // Appeler l'IA via Lovable AI Gateway avec structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "carousel_plan",
            schema: responseSchema
          }
        }
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error('[alfie-plan-carousel] AI Gateway error:', status, errorText);
      const message = status === 429
        ? 'Rate limits exceeded, please try again later.'
        : status === 402
        ? 'Payment required, please add funds to your Lovable AI workspace.'
        : 'AI gateway error';
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const jsonResponse = data.choices?.[0]?.message?.content;
    
    if (!jsonResponse) {
      throw new Error('AI returned an empty response');
    }

    const parsed: SimplifiedCarouselPlan = JSON.parse(jsonResponse);
    
    // Validation de structure
    if (!parsed.style || !Array.isArray(parsed.prompts) || !Array.isArray(parsed.slides)) {
      console.error('[alfie-plan-carousel] Invalid structure:', parsed);
      throw new Error('Invalid plan structure: missing style, prompts, or slides');
    }

    // 🔴 VALIDATION POST-GÉNÉRATION : vérifier les champs obligatoires
    const validationErrors: string[] = [];
    
    parsed.slides.forEach((slide, index) => {
      const slideNum = index + 1;
      
      // Hero slides MUST have cta_primary
      if (slide.type === 'hero' && !slide.cta_primary) {
        validationErrors.push(`Slide ${slideNum} (hero): Missing mandatory cta_primary`);
        slide.cta_primary = 'Découvrir'; // Fallback
      }
      
      // Problem/Solution slides MUST have bullets (3-4 items)
      if ((slide.type === 'problem' || slide.type === 'solution')) {
        if (!slide.bullets || slide.bullets.length < 3) {
          validationErrors.push(`Slide ${slideNum} (${slide.type}): Missing or insufficient bullets (need 3-4, got ${slide.bullets?.length || 0})`);
          // Fallback: générer des bullets génériques
          slide.bullets = [
            `${slide.title} - Point clé 1`,
            `${slide.title} - Point clé 2`,
            `${slide.title} - Point clé 3`
          ];
        }
      }
      
      // CTA slides MUST have cta_primary
      if (slide.type === 'cta' && !slide.cta_primary) {
        validationErrors.push(`Slide ${slideNum} (cta): Missing mandatory cta_primary`);
        slide.cta_primary = 'En savoir plus'; // Fallback
      }
    });
    
    if (validationErrors.length > 0) {
      console.warn('[alfie-plan-carousel] ⚠️ Validation errors (fallbacks applied):', validationErrors);
    }

    // Ajuster le nombre de prompts
    if (parsed.prompts.length > slideCount) {
      parsed.prompts = parsed.prompts.slice(0, slideCount);
      console.warn(`[Plan Carousel] Truncated to ${slideCount} prompts`);
    } else if (parsed.prompts.length < slideCount) {
      while (parsed.prompts.length < slideCount) {
        parsed.prompts.push('Minimalist background, high contrast, clean composition');
      }
      console.warn(`[Plan Carousel] Padded to ${slideCount} prompts`);
    }

    // Ajuster le nombre de slides
    if (parsed.slides.length > slideCount) {
      parsed.slides = parsed.slides.slice(0, slideCount);
    } else if (parsed.slides.length < slideCount) {
      while (parsed.slides.length < slideCount) {
        parsed.slides.push({
          type: 'cta',
          title: 'En savoir plus',
          cta_primary: 'Découvrir'
        });
      }
    }

    // Logger les détails de chaque slide pour debug
    console.log('[alfie-plan-carousel] ✅ Plan generated:', {
      slideCount: parsed.prompts.length,
      slidesCount: parsed.slides.length,
      styleLength: parsed.style.length,
      style: parsed.style.substring(0, 100) + '...',
      slideDetails: parsed.slides.map((s, i) => ({
        num: i + 1,
        type: s.type,
        title: s.title.substring(0, 30),
        hasBullets: !!s.bullets,
        bulletsCount: s.bullets?.length || 0,
        hasCTA: !!s.cta_primary
      }))
    });

    return new Response(JSON.stringify({ 
      style: parsed.style, 
      prompts: parsed.prompts,
      slides: parsed.slides 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[alfie-plan-carousel] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
