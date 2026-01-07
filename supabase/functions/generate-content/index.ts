import { createClient } from "npm:@supabase/supabase-js@2";
import { uploadToCloudinary } from "../_shared/cloudinaryUploader.ts";

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, LOVABLE_API_KEY, validateEnv } from "../_shared/env.ts";
import { corsHeaders } from "../_shared/cors.ts";
interface GenerateContentRequest {
  type: 'image' | 'video';
  prompt: string;
  brandKit?: {
    id?: string;
    palette?: string[];
    logo_url?: string;
    name?: string;
  };
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, prompt, brandKit, duration, aspectRatio }: GenerateContentRequest = await req.json();
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY;
    const lovableApiKey = LOVABLE_API_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🎨 Generating ${type} for user ${user.id} with prompt:`, prompt);

    // Get active brand_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_brand_id')
      .eq('id', user.id)
      .single();
    
    const brandId = brandKit?.id || profile?.active_brand_id;

    if (type === 'image') {
      // Check quota before generation
      if (brandId) {
        const { data: quotaCheck } = await supabase.rpc('reserve_brand_quotas', {
          p_brand_id: brandId,
          p_visuals_count: 1,
          p_reels_count: 0,
          p_woofs_count: 0
        });

        if (!quotaCheck?.success) {
          return new Response(
            JSON.stringify({ 
              error: "Quota mensuel atteint ! Upgrade ton plan pour continuer.",
              code: "quota_exceeded"
            }), 
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Generate image with AI
      let fullPrompt = prompt;
      
      if (brandKit?.palette && brandKit.palette.length > 0) {
        fullPrompt += `. Use these brand colors: ${brandKit.palette.join(', ')}. Create a professional social media ready design.`;
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: fullPrompt
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        
        // Refund quota if generation failed
        if (brandId) {
          await supabase.rpc('refund_brand_quotas', {
            p_brand_id: brandId,
            p_visuals_count: 1,
            p_reels_count: 0,
            p_woofs_count: 0
          });
        }
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Trop de requêtes, patiente un instant !" }), 
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Crédits Lovable AI insuffisants sur ton workspace." }), 
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageDataUrl) {
        // Refund quota
        if (brandId) {
          await supabase.rpc('refund_brand_quotas', {
            p_brand_id: brandId,
            p_visuals_count: 1,
            p_reels_count: 0,
            p_woofs_count: 0
          });
        }
        throw new Error("Aucune image générée");
      }

      // Upload to Cloudinary
      console.log("📤 Uploading to Cloudinary...");
      const uploadResult = await uploadToCloudinary(imageDataUrl, {
        folder: 'generated-images',
        tags: ['ai-generated', 'content-generator', user.id],
        context: {
          user_id: user.id,
          brand_id: brandId || 'none',
          prompt: prompt.substring(0, 100)
        }
      });

      console.log("✅ Uploaded to Cloudinary:", uploadResult.secureUrl);

      // Save to media_generations
      const { data: mediaGen, error: insertError } = await supabase
        .from('media_generations')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          type: 'image',
          engine: 'gemini-2.5-flash-image',
          status: 'completed',
          prompt: prompt.substring(0, 500),
          output_url: uploadResult.secureUrl,
          thumbnail_url: uploadResult.secureUrl,
          metadata: {
            cloudinary_public_id: uploadResult.publicId,
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            aspect_ratio: aspectRatio || '1:1',
            brand_name: brandKit?.name,
            generated_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to save to media_generations:", insertError);
      } else {
        console.log("💾 Saved to media_generations:", mediaGen.id);
      }

      return new Response(
        JSON.stringify({ 
          contentUrl: uploadResult.secureUrl,
          publicId: uploadResult.publicId,
          type: 'image',
          mediaGenerationId: mediaGen?.id,
          message: data.choices?.[0]?.message?.content 
        }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (type === 'video') {
      return new Response(
        JSON.stringify({ 
          error: "La génération vidéo n'est pas encore implémentée. Utilise l'onglet Studio pour générer des vidéos ! 🎥",
          status: "not_implemented"
        }), 
        { 
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    throw new Error("Type de contenu invalide");

  } catch (error) {
    console.error("Error in generate-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
