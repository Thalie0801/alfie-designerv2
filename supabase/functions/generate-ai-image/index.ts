import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { consumeBrandQuota } from "../_shared/quota.ts";

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
        JSON.stringify({ error: 'No active brand found. Please create a brand first.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Consume quota BEFORE generating (with user ID for admin check)
    const quotaResult = await consumeBrandQuota(supabaseClient, brandId, 'visual', 0, user.id);
    if (!quotaResult.success) {
      return new Response(
        JSON.stringify({ error: quotaResult.error || 'Quota exhausted' }),
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

    // Ajouter le ratio au prompt pour Gemini
    const ratioDescriptions: Record<string, string> = {
      "1:1": "square format (1:1 aspect ratio, 1024x1024px)",
      "4:5": "portrait format (4:5 aspect ratio, 1024x1280px)",
      "9:16": "vertical format (9:16 aspect ratio, 1024x1820px)",
      "16:9": "horizontal format (16:9 aspect ratio, 1820x1024px)"
    };

    const enhancedPrompt = `${prompt}. Create this image in ${ratioDescriptions[aspectRatio] || ratioDescriptions["1:1"]}. High quality, professional result.`;

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
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      throw new Error("No image generated");
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
