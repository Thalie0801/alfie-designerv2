import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { consumeBrandQuotas } from "../_shared/quota.ts";
import { incrementMonthlyVisuals } from "../_shared/quotaUtils.ts";
import { userHasAccess } from "../_shared/accessControl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Verify user and get active brand
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('active_brand_id')
      .eq('id', user.id)
      .single();

    const brandId = profile?.active_brand_id;
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'No active brand selected. Please select a brand.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Vérifier l'accès (Stripe OU granted_by_admin)
    const hasAccess = await userHasAccess(req.headers.get('Authorization'));
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const brandId = profile?.active_brand_id;
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'No active brand found. Please create a brand first.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Récupérer le Brand Kit pour enrichir la génération
    const { data: brandKit } = await supabaseClient
      .from('brand_kits')
      .select('primary_color, secondary_color, accent_color, logo_url, brand_voice')
      .eq('brand_id', brandId)
      .maybeSingle();

    let brandContext = "";
    if (brandKit) {
      const colors = [brandKit.primary_color, brandKit.secondary_color, brandKit.accent_color]
        .filter(Boolean)
        .join(', ');
      
      if (colors) {
        brandContext += `Brand identity: use these exact colors ${colors}. `;
      }
      
      if (brandKit.brand_voice) {
        brandContext += `Brand style: ${brandKit.brand_voice}. `;
      }
      
      if (brandKit.logo_url) {
        brandContext += `Include subtle brand logo elements. `;
      }
    }

    try {
      await consumeBrandQuotas(brandId);
    } catch (quotaError) {
      return new Response(
        JSON.stringify({ error: quotaError instanceof Error ? quotaError.message : 'Quota exhausted' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const { prompt, aspectRatio = "1:1" } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required field: prompt" }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log("Generating image with prompt:", prompt, "Aspect ratio:", aspectRatio);

    // Reformuler les prompts conversationnels en prompts descriptifs
    const reformulatePrompt = (userPrompt: string): string => {
      // Si c'est une demande conversationnelle en français
      if (/^(fais|fait|faire|cr[éeè]e|g[éeè]n[éeè]re|je veux|donne|montre)/i.test(userPrompt)) {
        return userPrompt
          .replace(/^(fais|fait|faire|cr[éeè]e|g[éeè]n[éeè]re|je veux|donne|montre)(-moi)?/i, '')
          .replace(/visuels?|images?|un carrousel de \d+/gi, '')
          .trim();
      }
      return userPrompt;
    };

    // Ajouter le ratio au prompt pour Gemini
    const ratioDescriptions: Record<string, string> = {
      "1:1": "square format (1:1 aspect ratio, 1024x1024px)",
      "4:5": "portrait format (4:5 aspect ratio, 1024x1280px)",
      "9:16": "vertical format (9:16 aspect ratio, 1024x1820px)",
      "16:9": "horizontal format (16:9 aspect ratio, 1820x1024px)"
    };

    const basePrompt = reformulatePrompt(prompt);
    const enhancedPrompt = `Professional marketing visual: ${basePrompt}. ${brandContext}${ratioDescriptions[aspectRatio] || ratioDescriptions["1:1"]}. High quality, clean composition, brand-ready design.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de génération atteinte. Réessayez dans quelques instants." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits AI épuisés. Contactez le support." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération de l'image. Réessayez." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log("AI Gateway response:", JSON.stringify(data, null, 2));
    
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("No image URL found in response. Full response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ 
          error: "L'IA n'a pas généré d'image. Essayez de reformuler votre demande ou réessayez dans quelques instants." 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let finalUrl = generatedImageUrl;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (supabaseUrl && supabaseKey) {
        const assetClient = createClient(supabaseUrl, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        let binary: Uint8Array | null = null;
        let contentType = 'image/png';
        let ext = 'png';

        if (generatedImageUrl.startsWith('data:image')) {
          const match = generatedImageUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.*)$/);
          if (match) {
            contentType = match[1];
            ext = match[2] === 'jpeg' ? 'jpg' : match[2];
            const b64 = match[3];
            const raw = atob(b64);
            const arr = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
            binary = arr;
          }
        }

        if (!binary) {
          const assetResponse = await fetch(generatedImageUrl);
          if (assetResponse.ok) {
            const arrayBuffer = await assetResponse.arrayBuffer();
            contentType = assetResponse.headers.get('content-type') || contentType;
            if (contentType.includes('jpeg')) ext = 'jpg';
            else if (contentType.includes('webp')) ext = 'webp';
            else ext = 'png';
            binary = new Uint8Array(arrayBuffer);
          }
        }

        if (binary) {
          const filePath = `generated/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await assetClient.storage
            .from('media-generations')
            .upload(filePath, binary, {
              contentType,
              upsert: false,
            });

          if (!uploadError) {
            const { data: publicUrl } = assetClient.storage
              .from('media-generations')
              .getPublicUrl(filePath);
            if (publicUrl?.publicUrl) {
              finalUrl = publicUrl.publicUrl;
            }
          } else {
            console.warn('Upload to media-generations failed', uploadError);
          }
        }
      }
    } catch (storageError) {
      console.warn('Failed to persist generated image to media-generations bucket', storageError);
    }

    // Increment profile generations counter
    await incrementMonthlyVisuals(user.id);

    // Save to media_generations for library
    try {
      await supabaseClient
        .from('media_generations')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          type: 'image',
          status: 'completed',
          prompt: prompt.substring(0, 500),
          output_url: finalUrl,
          thumbnail_url: finalUrl,
          metadata: {
            aspectRatio,
            generatedAt: new Date().toISOString(),
            via: 'generate-ai-image'
          }
        });
      console.log('Image saved to library');
    } catch (insertError) {
      console.error('Failed to save image to library:', insertError);
    }

    console.log("Image generated successfully");
    return new Response(JSON.stringify({ imageUrl: finalUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error in generate-ai-image function:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
