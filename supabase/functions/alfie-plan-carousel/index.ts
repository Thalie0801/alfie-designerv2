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

interface SimplifiedCarouselPlan {
  style: string;
  prompts: string[];
}

serve(async (req) => {
  console.log('[alfie-plan-carousel] v1.0.0 - Function invoked');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, slideCount, brandKit } = await req.json();

    if (!prompt || !slideCount) {
      throw new Error('Missing prompt or slideCount');
    }

    const brandInfo = brandKit as BrandKit;
    
    // Extraire les couleurs de la palette
    const primary_color = brandInfo?.palette?.[0] || 'vibrant blue';
    const secondary_color = brandInfo?.palette?.[1] || 'warm orange';
    
    // Construire le prompt système SIMPLIFIÉ
    const systemPrompt = `You are Alfie, a social media carousel expert.

Your task: Generate a cohesive visual plan for ${slideCount} carousel slides.

OUTPUT FORMAT:
- "style": A single, detailed visual style description that applies to ALL slides
- "prompts": An array of ${slideCount} scene descriptions (one per slide)

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

Example output:
{
  "style": "Vibrant gradient backgrounds blending ${primary_color} to ${secondary_color}. Modern, minimalist composition with high contrast center areas. Geometric shapes as accents. Professional and energetic mood.",
  "prompts": [
    "Dynamic gradient opening scene with abstract shapes, high energy",
    "Clean solid background with subtle geometric pattern",
    "Minimalist gradient with focus on center area",
    "Bold energetic scene for call-to-action mood"
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
        }
      },
      required: ["style", "prompts"]
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
    
    // Validation
    if (!parsed.style || !Array.isArray(parsed.prompts)) {
      console.error('[alfie-plan-carousel] Invalid structure:', parsed);
      throw new Error('Invalid plan structure: missing style or prompts');
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

    console.log('[alfie-plan-carousel] ✅ Plan generated:', {
      slideCount: parsed.prompts.length,
      styleLength: parsed.style.length,
      style: parsed.style.substring(0, 100) + '...'
    });

    return new Response(JSON.stringify({ style: parsed.style, prompts: parsed.prompts }), {
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
