import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

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

    // Vérifier les quotas avec la fonction can_create_video
    const { data: quotaCheck, error: quotaError } = await supabase.rpc('can_create_video', {
      user_id_param: user.id,
      duration_seconds: duration
    });

    if (quotaError || !quotaCheck || quotaCheck.length === 0) {
      console.error('Quota check error:', quotaError);
      return new Response(
        JSON.stringify({ error: 'Failed to check quota' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quota = quotaCheck[0];
    if (!quota.can_create) {
      const statusCode = quota.reason.includes('Insufficient') ? 402 : 403;
      return new Response(
        JSON.stringify({ 
          error: quota.reason,
          woofs_available: quota.woofs_available,
          woofs_needed: quota.woofs_needed
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Consommer les Woofs
    const { data: consumeResult, error: consumeError } = await supabase.rpc('consume_woofs', {
      user_id_param: user.id,
      woofs_amount: quota.woofs_needed
    });

    if (consumeError || !consumeResult) {
      console.error('Consume woofs error:', consumeError);
      return new Response(
        JSON.stringify({ error: 'Failed to consume Woofs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le brand_id actif de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_brand_id')
      .eq('id', user.id)
      .single();

    // Créer l'entrée vidéo
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        brand_id: profile?.active_brand_id,
        title,
        duration,
        ratio: ratio || '16:9',
        template_id,
        status: 'queued',
        assets,
        tts_config: tts,
        woofs_cost: quota.woofs_needed
      })
      .select()
      .single();

    if (videoError) {
      console.error('Video creation error:', videoError);
      // Rembourser les Woofs en cas d'erreur
      await supabase.rpc('refund_woofs', {
        user_id_param: user.id,
        woofs_amount: quota.woofs_needed
      });
      return new Response(
        JSON.stringify({ error: 'Failed to create video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log de la génération
    await supabase.from('generation_logs').insert({
      user_id: user.id,
      brand_id: profile?.active_brand_id,
      type: 'video',
      status: 'queued',
      woofs_cost: quota.woofs_needed,
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