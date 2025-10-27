import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userHasAccess } from "../_shared/accessControl.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  type: 'hero' | 'carousel' | 'insight' | 'reel';
  theme: string;
  style?: string;
  brandVoice?: string;
  channel?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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

    // Vérifier l'accès (Stripe OU granted_by_admin)
    const hasAccess = await userHasAccess(req.headers.get('Authorization'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { type, theme, style = 'moderne', brandVoice = 'professionnel', channel = 'LinkedIn' }: GenerateRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // System prompt for Alfie
    const systemPrompt = `Tu es Alfie, Directeur Artistique IA expert en création de contenu visuel pour les réseaux sociaux.

Ton rôle est de générer des textes percutants et concis pour différents types de visuels :
- HERO : Post d'annonce impactant (Headline ≤12 mots, Subtext ≤20 mots, CTA impératif court)
- CAROUSEL : Contenu éducatif (Hook ≤12 mots, 3-5 Steps ≤45 caractères chacun, CTA court)
- INSIGHT : Statistique/preuve (Metric court, Context ≤15 mots, CTA court)
- REEL : Vidéo courte (Hook ≤8 mots, 3-5 Steps séparés par |, CTA court)

Règles strictes :
1. Textes ULTRA CONCIS et impactants
2. Ton ${brandVoice}, adapté à ${channel}
3. Style ${style}
4. Hook qui capte l'attention immédiatement
5. CTA = verbe d'action + bénéfice (2-4 mots max)
6. Réponds UNIQUEMENT en JSON avec cette structure exacte

Format de réponse JSON :
{
  "headline": "...",
  "hook": "...",
  "steps": ["...", "...", "..."],
  "cta": "...",
  "caption": "...",
  "hashtags": ["...", "...", "..."]
}`;

    const userPrompt = `Génère un ${type.toUpperCase()} sur le thème : "${theme}"`;

    console.log('Calling Lovable AI with:', { type, theme, style, brandVoice, channel });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Trop de requêtes. Réessayez dans quelques instants.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits insuffisants. Veuillez recharger votre compte Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated');
    }

    console.log('Generated content:', content);

    // Parse JSON response from AI
    let generatedContent;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      generatedContent = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      // Fallback: return a basic structure
      generatedContent = {
        headline: "Contenu généré",
        hook: theme.slice(0, 50),
        steps: ["Étape 1", "Étape 2", "Étape 3"],
        cta: "En savoir plus",
        caption: theme,
        hashtags: ["#marketing", "#design", "#créativité"]
      };
    }

    return new Response(
      JSON.stringify({
        type,
        content: generatedContent,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in alfie-generate:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Une erreur est survenue',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
