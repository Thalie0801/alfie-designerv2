import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { VISION_SYSTEM_PROMPT } from "./systemPrompt.ts";
import { validateVisionOutput, type VisionOutput } from "../_shared/visionTypes.ts";

interface VisionRequest {
  intent: {
    kind: 'image' | 'carousel' | 'video_premium';
    platform: string;
    ratio?: string;
    goal?: string;
    tone?: string;
    prompt: string;
    count?: number;
    slidesCount?: number;
    durationSeconds?: number;
    style?: string;
  };
  brand: {
    name?: string;
    colors?: { 
      primary?: string; 
      secondary?: string; 
      accent?: string;
      background?: string;
    };
    voice?: string;
    niche?: string;
    useBrandKit: boolean;
  };
  memory?: {
    previousCampaigns?: string[];
    preferences?: Record<string, any>;
  };
  textSource?: 'ai' | 'user';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json() as VisionRequest;
    console.log('[alfie-vision] Request:', { 
      kind: body.intent?.kind, 
      platform: body.intent?.platform,
      useBrandKit: body.brand?.useBrandKit 
    });

    // Validation des entrées
    if (!body.intent || !body.intent.kind || !body.intent.prompt) {
      return new Response(JSON.stringify({ error: 'Missing required fields: intent.kind and intent.prompt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vérifier que le kind est supporté (plus de video_standard)
    const supportedKinds = ['image', 'carousel', 'video_premium'];
    if (!supportedKinds.includes(body.intent.kind)) {
      return new Response(JSON.stringify({ 
        error: `Invalid intent.kind: ${body.intent.kind}. Supported values: ${supportedKinds.join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Préparer le payload pour l'IA
    const userMessage = JSON.stringify({
      intent: body.intent,
      brand: body.brand || {},
      memory: body.memory || {},
      textSource: body.textSource || 'user'
    }, null, 2);

    // Appeler Lovable AI avec response_format JSON
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[alfie-vision] Calling Lovable AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[alfie-vision] AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    
    if (!rawContent) {
      throw new Error('No content in AI response');
    }

    console.log('[alfie-vision] Raw AI response length:', rawContent.length);

    // Parser le JSON
    let visionOutput: VisionOutput;
    try {
      visionOutput = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('[alfie-vision] JSON parse error:', parseError);
      console.error('[alfie-vision] Raw content:', rawContent.substring(0, 500));
      throw new Error('Invalid JSON from AI');
    }

    // Valider le JSON
    if (!validateVisionOutput(visionOutput)) {
      console.error('[alfie-vision] Validation failed:', visionOutput);
      throw new Error('Invalid VisionOutput structure');
    }

    console.log('[alfie-vision] Success:', {
      kind: visionOutput.kind,
      target: visionOutput.target,
      model: visionOutput.model,
      imagesCount: visionOutput.images?.length,
      slidesCount: visionOutput.slides?.length,
      hasVideo: !!visionOutput.video
    });

    return new Response(JSON.stringify(visionOutput), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[alfie-vision] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
