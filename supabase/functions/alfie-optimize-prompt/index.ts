// ============================================
// Alfie Optimize Prompt - Transformation de prompts utilisateur en directives précises
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { callAIWithFallback, enrichPromptWithBrandKit, type AgentContext } from "../_shared/aiOrchestrator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  prompt: string;
  type: 'image' | 'carousel' | 'video';
  brandId?: string;
  aspectRatio?: string;
}

interface OptimizationResult {
  optimizedPrompt: string;
  reasoning: string;
  negativePrompt: string;
  suggestedAspectRatio?: string;
  estimatedGenerationTime?: string;
  brandAlignment?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const { prompt, type, brandId, aspectRatio }: OptimizationRequest = await req.json();

    if (!prompt || !type) {
      return new Response(JSON.stringify({ error: 'Missing prompt or type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer le Brand Kit si brandId fourni
    let brandKit: AgentContext['brandKit'] = undefined;
    if (brandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('name, palette, fonts, voice, niche')
        .eq('id', brandId)
        .single();
      
      if (brand) {
        brandKit = {
          name: brand.name,
          colors: brand.palette || [],
          fonts: brand.fonts || [],
          voice: brand.voice,
          niche: brand.niche
        };
      }
    }

    console.log('[Optimize Prompt] Request:', { type, prompt, hasBrandKit: !!brandKit });

    // Construire le system prompt selon le type
    const systemPrompt = buildSystemPromptForType(type, brandKit);

    // Appeler l'IA pour optimiser
    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `User raw request: "${prompt}"

Aspect ratio: ${aspectRatio || 'not specified'}

Transform this into an optimized prompt. Return JSON with:
{
  "optimizedPrompt": "ultra-detailed prompt optimized for ${type === 'image' ? 'Gemini NanoBanana' : type === 'video' ? 'Sora2/Seededance' : 'carousel generation'}",
  "reasoning": "explain your creative choices and how it respects Brand Kit",
  "negativePrompt": "what to avoid in generation",
  "suggestedAspectRatio": "optimal ratio for this content",
  "estimatedGenerationTime": "time estimate",
  "brandAlignment": "how this respects brand guidelines"
}`
      }
    ];

    const response = await callAIWithFallback(
      messages,
      { 
        brandKit, 
        userMessage: prompt 
      },
      undefined,
      'gemini' // Préférer Gemini pour le visuel
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No optimization response from AI');
    }

    // Parser la réponse JSON
    let result: OptimizationResult;
    try {
      result = JSON.parse(content);
    } catch {
      // Fallback si JSON invalide
      result = {
        optimizedPrompt: enrichPromptWithBrandKit(prompt, brandKit),
        reasoning: 'Fallback optimization applied',
        negativePrompt: 'blurry, low quality, distorted, amateur, watermark'
      };
    }

    console.log('[Optimize Prompt] Result:', {
      original: prompt.substring(0, 50),
      optimized: result.optimizedPrompt.substring(0, 50),
      reasoning: result.reasoning.substring(0, 100)
    });

    return new Response(JSON.stringify({
      ok: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Optimize Prompt] Error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function buildSystemPromptForType(type: string, brandKit: any): string {
  const basePrompt = `Tu es un expert en prompt engineering pour la génération de contenu visuel.

Ta mission : transformer un prompt utilisateur brut en directive ultra-précise optimisée pour l'API de génération.`;

  if (type === 'image') {
    return `${basePrompt}

**SPÉCIALISATION IMAGE (Gemini NanoBanana):**

Gemini excelle avec des prompts ultra-détaillés incluant :
- Composition précise (angles, cadrage, règle des tiers)
- Couleurs EXACTES (codes HEX si Brand Kit fourni)
- Lighting (studio, natural, golden hour, rim light)
- Mood/ambiance (energetic, calm, professional, playful)
- Qualité technique (8K, high resolution, professional grade)
- Style artistique (photography, illustration, 3D render)

${brandKit ? `
**BRAND KIT À RESPECTER:**
- Couleurs: ${brandKit.colors?.join(', ')}
- Style: ${brandKit.voice || 'professional'}
- Secteur: ${brandKit.niche || 'business'}
` : ''}

**EXEMPLE DE TRANSFORMATION:**
INPUT: "Une pub pour mes chaussures de running"
OUTPUT: "Professional product photography of sleek modern running shoes, dynamic 45° angle with subtle motion blur, vibrant gradient background in brand colors (#FF5733, #3498DB), studio lighting with soft rim shadows creating depth, high energy athletic mood, commercial advertising aesthetic, 8K quality, sharp focus on product details"`;
  
  } else if (type === 'video') {
    return `${basePrompt}

**SPÉCIALISATION VIDÉO (Sora2/Seededance/Kling):**

Les APIs vidéo nécessitent des descriptions TEMPORELLES détaillées :
- Mouvement de caméra (dolly, pan, zoom, static)
- Actions/mouvement dans la scène
- Transitions temporelles (début → milieu → fin)
- Cinématographie (shallow DOF, stabilized, handheld)
- Pacing (slow motion, real-time, time-lapse)
- Visual effects (particles, light rays, reflections)

${brandKit ? `
**BRAND KIT À RESPECTER:**
- Couleurs: ${brandKit.colors?.join(', ')}
- Style: ${brandKit.voice || 'professional'}
- Secteur: ${brandKit.niche || 'business'}
` : ''}

**EXEMPLE DE TRANSFORMATION:**
INPUT: "Vidéo de ma chaussure qui court"
OUTPUT: "Dynamic slow-motion footage of sleek running shoes hitting pavement, camera follows with smooth dolly tracking shot at ground level, vibrant brand colors (#FF5733) accentuate shoe details, cinematic depth of field with motion blur on background, high-energy athletic atmosphere, professional sports commercial aesthetic, 24fps cinematic quality"`;
  
  } else { // carousel
    return `${basePrompt}

**SPÉCIALISATION CARROUSEL:**

Un carrousel nécessite une COHÉRENCE VISUELLE entre slides :
- Style graphique uniforme
- Palette couleurs constante (Brand Kit)
- Hiérarchie typographique cohérente
- Rythme de composition similaire
- Progression narrative logique

${brandKit ? `
**BRAND KIT À RESPECTER:**
- Couleurs: ${brandKit.colors?.join(', ')}
- Style: ${brandKit.voice || 'professional'}
- Secteur: ${brandKit.niche || 'business'}
` : ''}

**EXEMPLE DE TRANSFORMATION:**
INPUT: "Carrousel sur les bienfaits du sport"
OUTPUT SLIDE 1: "Clean minimalist Instagram carousel slide 1/5 with bold headline 'Benefits of Sports', brand color gradient background (#FF5733 to #3498DB), modern sans-serif typography, ample white space for readability, professional infographic aesthetic"`;
  }
}
