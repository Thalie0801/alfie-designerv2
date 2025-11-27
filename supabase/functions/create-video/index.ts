import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, validateEnv } from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { title, duration, ratio, template_id, assets, tts } = await req.json();

    // Valider les données
    if (!title || !duration || !assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le brand_id actif de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_brand_id')
      .eq('id', user.id)
      .single();

    if (!profile?.active_brand_id) {
      return new Response(
        JSON.stringify({ error: 'No active brand found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const brandId = profile.active_brand_id;

    // Vérifier et consommer les Woofs (vidéo basic = 10 Woofs)
    const adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const woofsCost = WOOF_COSTS.video_basic;
    
    const { data: woofsData, error: woofsError } = await adminClient.functions.invoke(
      "woofs-check-consume",
      {
        body: {
          brand_id: brandId,
          cost_woofs: woofsCost,
          reason: "video_basic",
          metadata: { 
            title,
            duration,
            ratio: ratio || '16:9'
          },
        },
      }
    );

    if (woofsError || !woofsData?.ok) {
      const errorCode = woofsData?.error?.code || "QUOTA_ERROR";
      if (errorCode === "INSUFFICIENT_WOOFS") {
        console.error("[create-video] Insufficient Woofs:", woofsData?.error);
        return new Response(
          JSON.stringify({ 
            error: "INSUFFICIENT_WOOFS",
            message: woofsData?.error?.message || "Tu n'as plus assez de Woofs pour cette génération.",
            remaining: woofsData?.error?.remaining || 0,
            required: woofsCost
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error("[create-video] Woofs consumption failed:", woofsError);
      return new Response(
        JSON.stringify({ error: 'Failed to consume Woofs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create-video] ✅ Consumed ${woofsCost} Woofs, remaining: ${woofsData.data.remaining_woofs}`);

    // Créer l'entrée vidéo
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        brand_id: brandId,
        title,
        duration,
        ratio: ratio || '16:9',
        template_id,
        status: 'queued',
        assets,
        tts_config: tts,
        woofs_cost: woofsCost
      })
      .select()
      .single();

    if (videoError) {
      console.error('Video creation error:', videoError);
      
      // Rembourser les Woofs via decrement
      const now = new Date();
      const periodYYYYMM = parseInt(
        now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0')
      );
      
      await adminClient.rpc('decrement_monthly_counters', {
        p_brand_id: brandId,
        p_period_yyyymm: periodYYYYMM,
        p_images: 0,
        p_reels: 0,
        p_woofs: woofsCost,
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to create video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log de la génération
    await supabase.from('generation_logs').insert({
      user_id: user.id,
      brand_id: brandId,
      type: 'video',
      status: 'queued',
      woofs_cost: woofsCost,
      metadata: { duration, ratio, template_id, assets_count: assets.length }
    });

    return new Response(
      JSON.stringify({ 
        id: video.id,
        status: 'queued',
        message: 'Video generation started'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-video:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});