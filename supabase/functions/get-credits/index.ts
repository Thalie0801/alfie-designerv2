import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Récupérer le profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer la config du plan
    const { data: planConfig } = await supabase
      .from('plans_config')
      .select('*')
      .eq('plan', profile.plan || 'starter')
      .single();

    const woofsTotal = planConfig?.woofs_per_month || profile.quota_videos || 0;
    const woofsUsed = profile.woofs_consumed_this_month || 0;
    const visualsTotal = planConfig?.visuals_per_month || profile.quota_visuals_per_month || 0;
    const visualsUsed = profile.generations_this_month || 0;

    return new Response(
      JSON.stringify({
        plan: profile.plan || 'none',
        woofs_total: woofsTotal,
        woofs_used: woofsUsed,
        woofs_remaining: Math.max(0, woofsTotal - woofsUsed),
        visuals_total: visualsTotal,
        visuals_used: visualsUsed,
        visuals_remaining: Math.max(0, visualsTotal - visualsUsed),
        reset_date: profile.generations_reset_date,
        storage_days: planConfig?.storage_days || 30
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-credits:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});