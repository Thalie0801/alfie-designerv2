import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

interface SlideContent {
  title: string;
  subtitle?: string;
  bullets?: string[];
  cta?: string;
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

    // Construire le contexte de marque
    let brandContext = '';
    if (brandKit) {
      brandContext = `\nBrand Context:\n- Brand Name: ${brandKit.name || 'N/A'}\n- Colors: ${brandKit.palette?.join(', ') || 'N/A'}\n- Voice: ${brandKit.voice || 'professional'}`;
    }

    // Prompt système strict pour l'orthographe française
    const systemPrompt = `You are a French carousel content planner. Your task is to create a structured plan for ${slideCount} carousel slides based on the user's prompt.

CRITICAL FRENCH SPELLING RULES:
- Use PERFECT French spelling with proper accents: é, è, ê, à, ç, ù, etc.
- Common corrections to apply:
  * "puisence" → "puissance"
  * "décupèle/décuplèe" → "décuplée"
  * "vidéos captatives" → "vidéos captivantes"
  * "Marktplace/Marketpace" → "Marketplace"
  * "libérze" → "libérez"
  * "automutéée/automutée" → "automatisée"
  * "integration" → "intégration"
  * "créativ" → "créatif/créative"
  * "visuals" → "visuels"
  * "captvatines" → "captivantes"
  * "est nouvel nouvel" → "est un nouvel"
  * "vidéos étans" → "vidéos uniques"
  * "en en quequess" → "en quelques"
  * "artifécralle" → "artificielle"
  * "partranaire" → "partenaire"
  * "d'éeil" → "d'œil"

RESPONSE FORMAT:
Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "slides": [
    {
      "title": "MAIN TITLE HERE",
      "subtitle": "Optional subtitle",
      "bullets": ["Bullet 1", "Bullet 2"],
      "cta": "Optional CTA"
    }
  ]
}

Rules:
- Create exactly ${slideCount} slides
- Each slide should have a clear, impactful title
- Use proper French grammar and accents
- Maintain editorial coherence across all slides
- Keep titles concise (max 6 words)
- Bullets should be short and punchy (max 8 words each)
- CTA should be action-oriented (max 4 words)
${brandContext}`;

    const userMessage = `Create a ${slideCount}-slide carousel plan for:\n\n${prompt}`;

    console.log('Calling Lovable AI for carousel planning...');
    
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
        temperature: 0.7,
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

    console.log('AI response:', content);

    // Extraire le JSON de la réponse (enlever les markdown code blocks si présents)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const plan = JSON.parse(jsonContent);

    if (!plan.slides || !Array.isArray(plan.slides) || plan.slides.length !== slideCount) {
      throw new Error('Invalid plan structure returned from AI');
    }

    console.log(`Successfully created plan for ${slideCount} slides`);

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
