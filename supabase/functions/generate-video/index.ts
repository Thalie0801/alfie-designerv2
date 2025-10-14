import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 🔍 DEBUG: Log immédiat pour confirmer que la fonction est appelée
  console.log('🎬 [generate-video] Function called at:', new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const KIE_AI_API_KEY = Deno.env.get('KIE_AI_API_KEY');
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    
    if (!KIE_AI_API_KEY) {
      console.error('❌ KIE_AI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'KIE_AI_API_KEY non configuré. Configure-le dans les Secrets backend.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN is not set');
      return new Response(
        JSON.stringify({ error: 'REPLICATE_API_TOKEN non configuré. Configure-le dans les Secrets backend.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('📥 [generate-video] Request body:', JSON.stringify(body));

    // 🔧 MODE DIAGNOSTIC: Retourne l'IP sortante du backend pour whitelist Kie.ai
    if (body.diagnose === true) {
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        console.log('🌐 [Diagnostic] Outbound IP:', ipData.ip);
        return new Response(JSON.stringify({ 
          ip: ipData.ip,
          message: 'Ajoute cette IP à la whitelist Kie.ai: https://kie.ai/settings'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (diagError) {
        console.error('❌ [Diagnostic] Failed to get IP:', diagError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve IP' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    // Check status of existing generation
    if (body.generationId) {
      const provider = body.provider || 'sora';
      console.log(`Checking video generation status for ${provider}:`, body.generationId);
      
      if (provider === 'sora') {
        // Kie AI recordInfo endpoint
        const statusResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${body.generationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${KIE_AI_API_KEY}`,
          },
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error("Kie AI status check error:", statusResponse.status, errorText);
          throw new Error(`Status check failed: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();
        console.log("Kie.ai status:", JSON.stringify(statusData));
        
        let finalResponse: any = { status: 'processing' };

        if (statusData.data?.state === 'success') {
          const resultJson = JSON.parse(statusData.data.resultJson);
          finalResponse = {
            status: 'succeeded',
            output: resultJson.resultUrls?.[0] || null
          };
        } else if (statusData.data?.state === 'fail') {
          console.error("Kie.ai generation failed:", statusData.data);
          finalResponse = {
            status: 'failed',
            error: statusData.data.failMsg || 'Generation failed'
          };
        } else {
          finalResponse = {
            status: 'processing',
            progress: statusData.data?.state === 'generating' ? 50 : 10
          };
        }
        
        return new Response(JSON.stringify(finalResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Replicate status check (for Seededance and Kling)
        const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${body.generationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          },
        });

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error(`${provider} status check error:`, statusResponse.status, errorText);
          throw new Error(`Status check failed: ${statusResponse.statusText}`);
        }

        const prediction = await statusResponse.json();
        console.log(`${provider} status:`, JSON.stringify(prediction));
        
        let finalResponse: any = { status: 'processing' };

        if (prediction.status === 'succeeded') {
          finalResponse = {
            status: 'succeeded',
            output: prediction.output || null
          };
        } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
          finalResponse = {
            status: 'failed',
            error: prediction.error || 'Generation failed'
          };
        } else {
          finalResponse = {
            status: 'processing',
            progress: prediction.status === 'processing' ? 50 : 10
          };
        }
        
        return new Response(JSON.stringify(finalResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Start new video generation with cascade fallback
    if (!body.prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required field: prompt" }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log("🎬 [generate-video] Starting cascade fallback with prompt:", body.prompt);
    const aspectRatio = body.aspectRatio === '9:16' ? 'portrait' : 'landscape';
    
    // 1️⃣ TENTATIVE SORA2 (Kie.ai) avec timeout 5s
    try {
      console.log("🎬 [Sora2] Attempting generation...");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const kiePayload: any = {
        model: "sora-2-text-to-video",
        input: {
          prompt: body.prompt,
          aspect_ratio: aspectRatio
        }
      };
      
      if (body.imageUrl) {
        kiePayload.input.image = body.imageUrl;
      }
      
      const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KIE_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kiePayload),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (kieResponse.ok) {
        const generation = await kieResponse.json();
        if (generation.data?.taskId) {
          console.log("✅ [Sora2] Generation started with ID:", generation.data.taskId);
          return new Response(JSON.stringify({ 
            id: generation.data.taskId,
            provider: 'sora',
            status: 'processing'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } else {
        const errorText = await kieResponse.text();
        console.error(`❌ [Sora2] HTTP ${kieResponse.status}: ${errorText}`);
      }
      
      console.warn("⚠️ [Sora2] Failed or timeout, trying Seededance...");
      
    } catch (soraError: any) {
      if (soraError.name === 'AbortError') {
        console.warn("⏱️ [Sora2] Timeout (5s), trying Seededance...");
      } else {
        console.error("❌ [Sora2] Exception:", soraError?.message || soraError);
      }
    }
    
    // 2️⃣ FALLBACK SEEDEDANCE (Replicate/ByteDance)
    try {
      console.log("🎬 [Seededance] Attempting generation...");
      
      const seededanceResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "fcc89eae3420a0476cfa109f8afbd8304327acb7e0d4ddcf63a980e870898a6b",
          input: {
            prompt: body.prompt,
            aspect_ratio: body.aspectRatio || '16:9',
            duration: 5
          }
        })
      });
      
      if (seededanceResponse.ok) {
        const prediction = await seededanceResponse.json();
        console.log("✅ [Seededance] Generation started with ID:", prediction.id);
        return new Response(JSON.stringify({ 
          id: prediction.id,
          provider: 'seededance',
          status: 'processing'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      const errorText = await seededanceResponse.text();
      console.error(`❌ [Seededance] HTTP ${seededanceResponse.status}: ${errorText}`);
      console.warn("⚠️ [Seededance] Failed, trying Kling...");
      
    } catch (seededanceError: any) {
      console.error("❌ [Seededance] Exception:", seededanceError?.message || seededanceError);
    }
    
    // 3️⃣ FALLBACK FINAL : KLING (Replicate)
    try {
      console.log("🎬 [Kling] Attempting generation (final fallback)...");
      
      const klingPayload = {
        model: "kwaivgi/kling-v2.5-turbo-pro",
        input: {
          prompt: body.prompt,
          aspect_ratio: body.aspectRatio || '16:9',
          duration: 5
        }
      };
      
      console.log("📤 [Kling] Payload:", JSON.stringify(klingPayload));
      
      const klingResponse = await fetch('https://api.replicate.com/v1/models/kwaivgi/kling-v2.5-turbo-pro/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: klingPayload.input
        })
      });
      
      if (klingResponse.ok) {
        const prediction = await klingResponse.json();
        console.log("✅ [Kling] Generation started with ID:", prediction.id);
        return new Response(JSON.stringify({ 
          id: prediction.id,
          provider: 'kling',
          status: 'processing'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      const errorText = await klingResponse.text();
      console.error(`❌ [Kling] HTTP ${klingResponse.status}: ${errorText}`);
      throw new Error(`Kling generation failed: ${klingResponse.status}`);
      
    } catch (klingError: any) {
      console.error("❌ [Kling] Exception:", klingError?.message || klingError);
      throw new Error("All video providers failed");
    }
  } catch (error) {
    console.error("Error in generate-video function:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
