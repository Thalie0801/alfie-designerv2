import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const url = new URL(req.url);
    const path = url.pathname;

    // POST /v1/creations - Créer un livrable
    if (path.endsWith('/v1/creations') && req.method === 'POST') {
      return await handleCreateDeliverable(req, supabaseClient);
    }

    // GET /v1/creations/:id/preview - Obtenir preview
    if (path.includes('/preview')) {
      const id = path.split('/')[3];
      return await handleGetPreview(id, supabaseClient);
    }

    // POST /v1/creations/:id/confirm-premium - Confirmer Premium
    if (path.includes('/confirm-premium') && req.method === 'POST') {
      const id = path.split('/')[3];
      return await handleConfirmPremium(id, supabaseClient);
    }

    // GET /v1/creations/:id/deliver - Livraison PULL (Canva + ZIP)
    if (path.includes('/deliver')) {
      const id = path.split('/')[3];
      return await handleDeliver(id, supabaseClient);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in creations-api:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleCreateDeliverable(req: Request, supabase: any) {
  const { format, objective, styleChoice, brandId, brandKitId, assets, premiumT2VRequested } = await req.json();

  // Validation
  if (!format || !objective || !styleChoice || !brandId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Créer le livrable
  const { data: deliverable, error: insertError } = await supabase
    .from('deliverable')
    .insert({
      brand_id: brandId,
      format,
      objective,
      style_choice: styleChoice,
      status: 'pending',
      metadata: {
        brandKitId,
        assets,
        premiumT2VRequested: premiumT2VRequested || false,
      },
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating deliverable:', insertError);
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Incrémenter compteurs mensuels
  const periodYYYYMM = parseInt(new Date().toISOString().slice(0, 7).replace('-', ''));
  const incrementImages = format === 'image' ? 1 : 0;
  const incrementReels = format === 'reel' ? 1 : 0;

  await supabase.rpc('increment_monthly_counters', {
    p_brand_id: brandId,
    p_period_yyyymm: periodYYYYMM,
    p_images: incrementImages,
    p_reels: incrementReels,
    p_woofs: 0,
  });

  // Logger l'événement
  const eventKind = format === 'image' ? 'image_ai' : format === 'carousel' ? 'carousel_ai_image' : 'reel_export';
  await supabase.from('usage_event').insert({
    brand_id: brandId,
    deliverable_id: deliverable.id,
    kind: eventKind,
    meta: { objective, styleChoice },
  });

  // Lancer la génération en arrière-plan selon le type
  if (styleChoice === 'ia') {
    if (format === 'reel') {
      // Appeler generate-video
      await supabase.functions.invoke('generate-video', {
        body: {
          prompt: objective,
          aspectRatio: '9:16',
          deliverableId: deliverable.id,
          brandId,
        },
      });
    } else {
      // Appeler alfie-generate-ai-image
      await supabase.functions.invoke('alfie-generate-ai-image', {
        body: {
          prompt: objective,
          deliverableId: deliverable.id,
          brandId,
        },
      });
    }
  }

  return new Response(JSON.stringify(deliverable), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetPreview(id: string, supabase: any) {
  const { data: deliverable, error } = await supabase
    .from('deliverable')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !deliverable) {
    return new Response(JSON.stringify({ error: 'Deliverable not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Si pending, retourner 202 Accepted avec hint de polling
  if (deliverable.status === 'pending' || deliverable.status === 'processing') {
    return new Response(
      JSON.stringify({
        id: deliverable.id,
        status: deliverable.status,
        message: 'Generation in progress, poll again in a few seconds',
      }),
      {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify(deliverable), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleConfirmPremium(id: string, supabase: any) {
  const { data: deliverable, error } = await supabase
    .from('deliverable')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !deliverable) {
    return new Response(JSON.stringify({ error: 'Deliverable not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Vérifier quota Woofs
  const { data: brand } = await supabase
    .from('brands')
    .select('quota_woofs, woofs_used')
    .eq('id', deliverable.brand_id)
    .single();

  const woofsRequired = 4; // Veo3
  const woofsAvailable = (brand?.quota_woofs || 0) - (brand?.woofs_used || 0);

  if (woofsAvailable < woofsRequired) {
    return new Response(
      JSON.stringify({ error: 'Insufficient Woofs', woofsAvailable, woofsRequired }),
      {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Consommer Woofs
  const periodYYYYMM = parseInt(new Date().toISOString().slice(0, 7).replace('-', ''));
  await supabase.rpc('increment_monthly_counters', {
    p_brand_id: deliverable.brand_id,
    p_period_yyyymm: periodYYYYMM,
    p_images: 0,
    p_reels: 0,
    p_woofs: woofsRequired,
  });

  // Mettre à jour le livrable
  await supabase
    .from('deliverable')
    .update({ status: 'processing' })
    .eq('id', id);

  // Lancer génération Veo3
  await supabase.functions.invoke('generate-video', {
    body: {
      prompt: deliverable.objective,
      aspectRatio: '9:16',
      provider: 'veo3',
      deliverableId: id,
      brandId: deliverable.brand_id,
    },
  });

  // Logger événement Premium T2V
  await supabase.from('usage_event').insert({
    brand_id: deliverable.brand_id,
    deliverable_id: id,
    kind: 'premium_t2v',
    meta: { woofs_consumed: woofsRequired },
  });

  return new Response(
    JSON.stringify({ confirmed: true, woofs_consumed: woofsRequired }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleDeliver(id: string, supabase: any) {
  const { data: deliverable, error } = await supabase
    .from('deliverable')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !deliverable) {
    return new Response(JSON.stringify({ error: 'Deliverable not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (deliverable.status !== 'completed') {
    return new Response(
      JSON.stringify({ error: 'Deliverable not ready', status: deliverable.status }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Livraison PULL : Canva link + download URL direct
  return new Response(
    JSON.stringify({
      canva_link: deliverable.canva_link,
      download_url: deliverable.preview_url, // Téléchargement direct de l'asset
      preview_url: deliverable.preview_url,
      format: deliverable.format,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        objective: deliverable.objective,
        style_choice: deliverable.style_choice,
        created_at: deliverable.created_at,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
