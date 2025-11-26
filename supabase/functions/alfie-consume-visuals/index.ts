import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const supabaseAuth = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { cost_visuals = 1, brand_id, meta } = await req.json();

    // Débiter les visuels
    const { error: consumeError } = await supabaseAdmin.rpc('consume_visuals', { 
      user_id_param: user.id,
      brand_id_param: brand_id,
      visuals_amount: cost_visuals 
    });

    if (consumeError) {
      console.error('Failed to consume visuals:', consumeError);
      return new Response(JSON.stringify({ error: 'Failed to deduct visuals' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enregistrer la transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      brand_id: brand_id || null,
      type: 'debit_visuals',
      amount: cost_visuals,
      meta: meta || {}
    });

    // Récupérer le nouveau solde
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('generations_this_month, quota_visuals_per_month')
      .eq('id', user.id)
      .single();

    return new Response(JSON.stringify({
      success: true,
      balance: {
        visuals_used: profile?.generations_this_month || 0,
        visuals_total: profile?.quota_visuals_per_month || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in alfie-consume-visuals:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
